# repoio-stream

Apache Spark Structured Streaming jobs for the MDM pipeline.

## Jobs

| Job            | Input topic         | Output topic          | Iceberg table       |
|----------------|---------------------|-----------------------|---------------------|
| `standardise`  | `raw.<entity>`      | `staged.<entity>`     | `staged.<entity>`   |
| `dq`           | `staged.<entity>`   | `staged.<entity>`     | — (gates bad rows)  |
| `match`        | `staged.<entity>`   | `matched.<entity>`    | `matched_pairs`     |
| `survive`      | `matched.<entity>`  | `golden.<entity>`     | `golden.<entity>`   |
| `change_log`   | `golden.<entity>`   | `changes.<entity>`    | `change_log`        |

- Matching uses **Splink** (probabilistic record linkage)
- DQ uses **Great Expectations** suites generated from the entity schemas
- Survivorship rules are configurable per entity (per field: `source priority`,
  `longest`, `most recent`, `highest confidence`)

## Layout (to be filled during M3)

```
src/main/
  python/              # PySpark jobs (preferred for M3)
  scala/               # Scala jobs (optional, for high-throughput paths)
  resources/
    rules/
      customer-survivorship.yml
      vendor-survivorship.yml
    expectations/
      customer.ge.yml
docker/
  spark-worker.Dockerfile
```
