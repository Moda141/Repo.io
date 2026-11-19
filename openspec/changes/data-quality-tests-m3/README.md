# Change · Data quality tests, preview and alerts (M3)

Author: Mohamed · Status: **proposed** · Target: M3 (Python tests run from M8)

## Summary

Data Stewards define the data quality tests that the M3 stream runs, from the
console, in two ways: a visual builder for the common checks and a Python editor
for the rest. Both are stored as Great Expectations expectations. A second person
approves the tests that can stop data, a preview runs a test on sample records
in the DQ service (never in the browser), and alert rules route failures to the
right teams. The console screens exist as approved prototypes
(`repoio-ui/design-reference/openui5-prototype`, routes `#/data-quality/…` and
`#/admin/system/dq`); this change specifies the services behind them.

## Why

1. Most rules at Nahdet Misr are simple (not empty, in a reference list, phone
   format, length). Stewards should make them without waiting for an engineer.
2. A test on the repository gate can hold records in quarantine. A wrong
   threshold or a wrong rule stops good data from reaching matching, so changes
   that can stop data need a second person.
3. Trying a rule before it goes live must use the real engine on real (sample)
   records. A browser-side imitation would show results the stream does not
   produce, and would put business rules in the UI (CLAUDE.md rule 6).

## What changes

### Test model (control plane, Postgres)

- `dq_test` (id, level `repository|source`, repository or source table, column,
  check type, dimension, severity `quarantine|flag|warn`, threshold, author
  `builder|python`, status `draft|inReview|active|disabled`, owner, reviewer,
  reason, current version) and `dq_test_version` (the expectation configuration
  or the Python source, author, approver, approved at). Flyway migration in
  `bootstrap/sql/`.
- A builder test is stored as a Great Expectations 1.x expectation
  configuration (`ExpectColumnValuesToNotBeNull`, `…ToBeInSet` with the value set
  resolved from the reference data API at run time, `…ToMatchRegex`, `…Between`,
  `…LengthsToBeBetween`, `ExpectTableRowCountToBeBetween`,
  `ExpectColumnMaxToBeBetween` for freshness, `row_condition` for "required
  when"), with `mostly = threshold / 100` and `meta.severity`.
- A Python test is reviewed source using the `repoio_dq` helper decorators
  (`@column_check`, `@column_pair_check`, `@table_check`) that wrap it as a
  custom expectation.

### Where tests run

- **Repository gate** tests: in the M3 DQ streaming job, between standardise and
  match, on every batch of `staged.<entity>`. `quarantine` routes the record to
  the dead-letter / Quarantine path; `flag` lets it continue with the value
  flagged (it never wins survivorship); `warn` only records the result.
- **Source-table** tests: in the nightly DQ DAG
  (`dags/<domain>/<repository>/dq/…`, ADR-0005); they never hold records.
- Results: `dq.results` (Iceberg) per test and run — checked, failed, pass rate,
  sample of failing keys.
- **Python** tests run only in `repoio-python-runtime` workers (CLAUDE.md rule
  8: disposable, resource-limited, no network, package allowlist, no Docker
  socket or host mounts). Until M8 ships the runtime, Python tests can be
  written, previewed in a worker sandbox if available, and reviewed, but not
  activated.

### Thresholds

- Platform defaults in System configuration → Data quality: repository gate
  tests 99 %, source-table tests 95 % (*to be confirmed by the business owner*).
- A repository's data owner may set its own target, with a reason; it shows in
  System configuration and in the audit log.
- A test author may set a stricter threshold freely. A threshold below the
  effective default needs a reason and an approval.

### Approval (four eyes)

| Change | Approval |
|---|---|
| Builder test, severity `flag` or `warn`, threshold ≥ default | none — active at once (audited) |
| Builder test, severity `quarantine` | second person |
| Any test with a threshold below the default | second person, with a reason |
| Any Python test (new or changed) | reviewer, always |
| System configuration → "Every new or changed test" | second person for all |

The approver must be a different person from the author (separation of duties,
as in Roles & access); `dq.approve` permission; approvals and rejections are
written to the audit log. A test waiting for approval has status `inReview` and
does not run.

### Preview ("try on sample records")

`POST /api/v1/dq/tests/preview` with the test definition (unsaved) returns
`{ checked, passed, failed, passRate, failingSamples[≤5] }`:

- the DQ service runs the expectation with Great Expectations on a sample of
  `staged.<entity>` (repository tests) or the source table (source tests) of
  *N* records (System configuration → Data quality, default 1 000), read only,
  through Trino with the calling user's grants;
- failing samples are masked for PII columns (column `pii` flag in the catalog);
- a Python preview is a worker job (same isolation as a run) and returns its log;
  imports of files, network or system modules are rejected before it starts;
- nothing is written to `dq.results`.

### Alerts

- `alert_rule` (event, condition, scope, recipients as teams / roles, channels
  `inapp|email|teams`, severity, repeat, quiet hours, on/off) and `alert`
  (fired, status `open|ack|resolved`, handled by, resolution note) in the
  control plane. Events come from what already exists: `dq.results`, the
  Quarantine queue size, run status, consumer lag, CR due dates, worker errors,
  last record per connection.
- Email through the corporate SMTP relay (System configuration); Teams through a
  webhook *connection* whose secret stays in the vault (CLAUDE.md rule 13).
- Rules and alerts are permission-filtered server-side.

### API (repoio-spec first)

`GET/POST /dq/tests`, `GET/PUT /dq/tests/{id}`, `POST /dq/tests/{id}/submit`,
`POST /dq/tests/{id}/approve|reject`, `POST /dq/tests/{id}/pause|resume`,
`POST /dq/tests/{id}/run`, `GET /dq/tests/{id}/results`,
`POST /dq/tests/preview`, `GET/PUT /settings/data-quality`,
`GET/POST/PUT /alerts/rules`, `GET /alerts`, `POST /alerts/{id}/ack|resolve`.

## Non-goals

- No browser-side evaluation of checks or code (the prototype imitates the
  preview only to show the screen).
- No new event pipeline for alerts (they read existing events).
- No ML-generated rules or anomaly detection in this change.

## Acceptance criteria

- [ ] A builder test saved as `flag` is active at once and runs on the next batch.
- [ ] A `quarantine` test, or one below the default, stays `inReview` until a
      different person approves it; the author cannot approve their own test.
- [ ] Preview returns counts from the DQ service on N sample records, with PII
      masked; the UI shows them and never computes them.
- [ ] A Python test cannot run before review, and its preview runs in an
      isolated worker; a forbidden import is rejected before execution.
- [ ] A failing gate test holds the record in Quarantine (M3 dead-letter path)
      and the stream keeps running.
- [ ] Default thresholds and repository targets are read from settings, not
      hard-coded; every change is audited.
- [ ] An alert rule on `testFailed` fires once per run below threshold and
      links to the test; Teams delivery uses a vault-held webhook.

## Open questions (for the business owner)

1. Confirm the default thresholds (99 % gate, 95 % source).
2. Who approves: any second steward of the domain, or the repository's data
   owner?
3. Preview sample size and whether failing samples may show unmasked values to
   stewards with PII access.
