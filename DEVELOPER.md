# Repo.io · Developer Guide

## Prerequisites

- Java 17 (Temurin)
- Node 20 + Yarn 4
- Python 3.11
- Docker 24

## Clone and bootstrap

```bash
git clone https://github.com/Moda141/Repo.io.git
cd Repo.io
make bootstrap
```

## Backend

```bash
cd repoio-service
./mvnw dropwizard:run
```

## UI

```bash
cd repoio-ui/src/main/resources/ui
yarn install && yarn start
```

## Ingestion

```bash
cd ingestion
python -m metadata.cli ingest --config pipelines/nahdet-c4c-customers.yaml
```
