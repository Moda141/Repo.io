"""Entry point for ingestion workflows."""
from importlib import import_module
def run(config: dict) -> None:
    src = import_module(f"metadata.ingestion.source.{config['source']['type']}.source")
    sink = import_module(f"metadata.ingestion.sink.{config['sink']['type'].replace('-','_')}")
    for batch in src.read(config['source']['config']):
        sink.write(batch, config['sink']['config'])
