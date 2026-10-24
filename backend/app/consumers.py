"""Kafka consumer process: ``python -m app.consumers``.

One consumer group handles both stages (raw -> normalized, normalized -> database) and publishes follow-up events.
Offsets are committed only after a batch is fully processed and its follow-up events are flushed (at-least-once).
Infrastructure errors (database/Kafka down) stop the process without committing, so the orchestrator restarts it and
processing resumes from the last committed offset. Bad data never stops it: it goes to the DLQ.
"""
from __future__ import annotations

import json
import logging
import signal
import sys
import threading

from .bus import KafkaBus
from .config import settings
from .events import RAW_PATTERN, TOPIC_DLQ, TOPIC_NORMALIZED
from .pipeline import process_message

log = logging.getLogger("consumers")
BATCH = 100


def run(stop: threading.Event | None = None) -> None:
    from confluent_kafka import Consumer, KafkaError

    stop = stop or threading.Event()
    bus = KafkaBus(settings.kafka_bootstrap)
    consumer = Consumer(
        {
            "bootstrap.servers": settings.kafka_bootstrap,
            "group.id": settings.kafka_group_id,
            "enable.auto.commit": False,
            "auto.offset.reset": "earliest",
            "metadata.max.age.ms": 10_000,  # discover new mdm.raw.<system>.<entity> topics quickly
            "max.poll.interval.ms": 600_000,
        }
    )
    consumer.subscribe([RAW_PATTERN, TOPIC_NORMALIZED])
    log.info("consuming %s and %s as group %s", RAW_PATTERN, TOPIC_NORMALIZED, settings.kafka_group_id)
    try:
        while not stop.is_set():
            messages = consumer.consume(num_messages=BATCH, timeout=1.0)
            handled = 0
            for message in messages:
                error = message.error()
                if error is not None:
                    if error.code() == KafkaError.UNKNOWN_TOPIC_OR_PART:  # regex subscription before any topic exists
                        continue
                    if error.fatal():
                        raise RuntimeError(f"fatal Kafka error: {error}")
                    log.warning("kafka error: %s", error)
                    continue
                try:
                    value = json.loads(message.value())
                except (ValueError, TypeError):
                    bus.publish(TOPIC_DLQ, message.topic(), {"stage": "consumer", "error": "message is not valid JSON", "topic": message.topic()})
                    handled += 1
                    continue
                process_message(bus, message.topic(), value)
                handled += 1
            if messages:
                bus.flush()  # follow-up events must be delivered before the input offsets are committed
                consumer.commit(asynchronous=False)
                if handled:
                    log.info("processed %d message(s)", handled)
    finally:
        consumer.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    try:
        run(stop)
    except Exception:  # noqa: BLE001
        log.exception("consumer stopped on an infrastructure error; exiting so the orchestrator restarts it")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
