"""Event bus abstraction.

* ``InlineBus``: no broker. ``publish`` hands the event straight to the same handler functions the Kafka
  consumers run, so small deployments and tests exercise exactly the production logic (envelope included).
* ``KafkaBus``: producer side of Kafka. The consuming side is ``app.consumers`` (``python -m app.consumers``).
"""
from __future__ import annotations

import json
import logging
import threading
from typing import Protocol

from .config import settings

log = logging.getLogger(__name__)


class Bus(Protocol):
    def publish(self, topic: str, key: str, value: dict) -> None: ...

    def flush(self) -> None: ...


class InlineBus:
    def __init__(self, capture: bool = False):
        self.capture = capture
        self.sent: list[tuple[str, str, dict]] = []  # only filled when capture=True (tests)

    def publish(self, topic: str, key: str, value: dict) -> None:
        if self.capture:
            self.sent.append((topic, key, value))
        from .pipeline import process_message  # late import: pipeline imports models, models import nothing from here

        process_message(self, topic, value)

    def flush(self) -> None:
        return None


class KafkaBus:
    """Idempotent, acks=all producer. Delivery failures are surfaced on flush()."""

    def __init__(self, bootstrap: str):
        from confluent_kafka import Producer

        self._producer = Producer(
            {
                "bootstrap.servers": bootstrap,
                "enable.idempotence": True,
                "acks": "all",
                "linger.ms": 20,
            }
        )
        self._errors: list[str] = []
        self._lock = threading.Lock()

    def _on_delivery(self, err, msg) -> None:
        if err is not None:
            with self._lock:
                self._errors.append(f"{msg.topic()}: {err}")

    def publish(self, topic: str, key: str, value: dict) -> None:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
        while True:
            try:
                self._producer.produce(topic, key=key.encode(), value=payload, on_delivery=self._on_delivery)
                break
            except BufferError:  # local queue full: let delivery reports drain, then retry
                self._producer.poll(1.0)
        self._producer.poll(0)

    def flush(self, timeout: float = 60.0) -> None:
        remaining = self._producer.flush(timeout)
        with self._lock:
            errors, self._errors = self._errors, []
        if errors:
            raise RuntimeError(f"{len(errors)} message(s) failed to deliver, first: {errors[0]}")
        if remaining:
            raise RuntimeError(f"{remaining} message(s) still undelivered after {timeout:.0f}s (is Kafka reachable?)")


_bus: Bus | None = None


def get_bus() -> Bus:
    global _bus
    if _bus is None:
        if settings.ingest_bus == "kafka":
            _bus = KafkaBus(settings.kafka_bootstrap)
        elif settings.ingest_bus == "inline":
            _bus = InlineBus()
        else:
            raise ValueError(f"MDM_INGEST_BUS must be 'inline' or 'kafka', got {settings.ingest_bus!r}")
    return _bus


def reset_bus() -> None:
    global _bus
    _bus = None
