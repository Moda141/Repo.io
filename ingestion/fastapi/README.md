# ingestion/fastapi

Push-ingest API for Repo.io, built on **FastAPI** (Python 3.11).

Source systems that can push events in real time land here. The service
validates each payload against the matching JSON Schema from
`repoio-spec/`, writes it to the Kafka `raw.<entity>` topic, and acks the
caller. From Kafka onward, `repoio-stream` takes over.

## Primary callers

- **SAP C4C** — webhook per Business Partner change
- **Internal apps** — any Nahdet Misr system that wants to publish a
  master-data event
- **Outbox consumer** — writes `changes.<entity>` back to SAP C4C

## Endpoints (M2)

```
POST /v1/ingest/{entity}            # single record
POST /v1/ingest/{entity}/batch      # up to 1000 records
GET  /v1/ingest/{entity}/schema     # returns JSON Schema from repoio-spec
GET  /healthz                       # liveness
GET  /readyz                        # Kafka + catalog reachable
```

Auth: Entra ID (service principal) in prod; API key in dev.

## Layout (to be filled during M2)

```
app/
  main.py                 # FastAPI entrypoint
  routes/
    ingest.py
    health.py
  core/
    schema_loader.py      # loads schemas from repoio-spec
    kafka_producer.py
    auth.py
  tests/
pyproject.toml
Dockerfile
```
