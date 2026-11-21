# ADR-0011 — Splink matching: fast, incremental and measured

- Status: **proposed** (2026-11-21, Mohamed) — to be accepted before M3
  implementation starts.
- Amends:
  - `.claude/skills/repoio-streaming-mdm/SKILL.md` (performance rules);
  - `docs/milestone-plan.md` M3 (performance acceptance items).
- Does not change:
  - Splink owns matching; Spark Structured Streaming runs the pipeline;
  - one streaming job per stage (standardise, DQ, match, survivorship);
  - `matched_pairs`, `golden_customer`, `change_log` on Iceberg v3;
  - match quality (precision/recall on labelled pairs) as the M3 gate.

## Context

Matching is the core of Repo.io: every golden record, every merge
candidate a steward reviews and every duplicate warning on a request form
comes from it. The owner's requirement is that matching runs smoothly,
with no visible delay, at Nahdet Misr volume (about 950 K customer
records today) and as records arrive.

Splink's run time is driven first by the number of record pairs it has to
score, then by how expensive each comparison is. In Spark, each blocking
rule is a join, so pairs are produced by a shuffle on the blocking key:
a key that is very common ("محمد", a large city, an empty phone) sends
most of the work to one task (skew). Splink is a batch library: scoring a
micro-batch against everything again would grow with the size of the
master data, not with the size of the batch.

## Decision

### 1. Train offline, score incrementally

- **Training** (EM, u/m probabilities, term-frequency tables) runs as a
  batch job (Airflow, `dags/<domain>/<repository>/match/…`, ADR-0005) on a
  sample, never inside the stream. Its output is a versioned Splink model
  (JSON settings) published through Models & rules; the stream only loads
  an approved version.
- **Scoring** in the match streaming job uses `foreachBatch`: only the new
  or changed `staged` records of the micro-batch are scored against the
  existing records (Splink "find matches to new records"), never
  all-against-all. Cost grows with the batch, not with the master data.
- A **full re-match** (all records, chunked with Splink's
  `num_chunks_left/right`) runs nightly or on a new model version, as a
  batch job; it never blocks the stream.

### 2. Blocking rules are cheap joins, measured before they run

- Blocking keys are computed once in the **standardise** job and stored on
  `staged_<entity>` (normalised Arabic name tokens, normalised phone, tax
  or commercial-register number, governorate + name key …). The match job
  only joins on them.
- Rules are **equality joins combined with AND**; each alternative is its
  own rule. No `OR` inside a rule, no similarity function (Levenshtein,
  Jaro-Winkler) in a blocking rule — those belong in comparisons.
- Every rule set is checked with Splink's comparison counts
  (`count_comparisons_from_blocking_rules`) on real data before a model
  version can be approved; the count and the slowest rule are shown in
  Models & rules. A **comparison budget per micro-batch** is configured;
  a rule set that exceeds it cannot be published.
- **Skew:** very common keys are salted (Splink `salting_partitions`,
  Spark backend) or capped; records with an empty blocking key do not form
  a block (Spark 4.3 `spark.sql.shuffle.spreadNullJoinKeys.enabled` is
  evaluated as an extra guard).

### 3. Comparisons stay in the engine

- Comparisons use Splink's built-in comparison functions (SQL executed by
  Spark), not Python UDFs. Arabic normalisation (hamza, taa marbuta, alef
  maksura, "عبد ال…", diacritics) happens once in the standardise job with
  Spark's built-in string functions (or a vectorised pandas UDF when a
  built-in is not enough), never row by row in the match job.
- `predict()` uses a match-probability threshold so only candidate pairs
  above it are written to `matched_pairs`; intermediate columns are not
  retained in the stream.

### 4. Two engines, one model

- **Stream and batch:** Splink on the Spark backend.
- **Interactive duplicate check** (the potential-match panel in request
  forms and the steward's "find similar" action, which must answer while
  the user types): Splink on the DuckDB backend, inside the matching
  service, with the **same approved model JSON**, scoring one candidate
  record against the blocking-key neighbourhood read from Iceberg (or
  `compare_two_records` for a single pair). No Spark job is started for a
  user action.

### 5. Performance targets (to confirm with the business owner)

| Path | Target (proposed) |
|---|---|
| New source record → candidate pair visible to stewards | ≤ 2 minutes end to end |
| Match micro-batch (up to 5 000 records) | ≤ 30 s, p95 |
| Request-form duplicate check | ≤ 1 s, p95 |
| Full re-match, 1 M records | ≤ 1 hour on the agreed cluster size |

The match job reports, per micro-batch: records scored, comparisons
generated, the busiest blocking key, duration and consumer lag. They are
shown in Data jobs → Streams and drive alerts (a batch over target, a
comparison count over budget, lag growing).

## Considered and rejected

- **Spark Real-Time Mode (4.3, ~100 ms)** for matching: the latency need is
  minutes for the pipeline and sub-second only for interactive checks; the
  stateful API in Real-Time Mode (`transformWithState`) is Scala/Java,
  while Splink is Python. Revisit if a sub-second pipeline requirement
  appears.
- **Re-running Splink on all records each micro-batch:** cost grows with
  the master data; ruled out.
- **Hand-written fuzzy matching for speed:** forbidden (CLAUDE.md §4).

## Consequences

- M3 gains performance acceptance items next to the quality report: the
  comparison-count check, the benchmark against the targets above on
  realistic volume, and the skew test.
- Models & rules must show the comparison count of a rule set, and refuse
  to publish one over budget (UI already has the place: the rule detail).
- The matching service needs the DuckDB backend as a pinned dependency.
- Spark version is pinned at M2 together with an Iceberg Spark runtime
  that supports v3; upgrades are deliberate (Spark moved to a quarterly
  feature release from 4.3).

## Open questions (business owner)

1. Confirm the targets in §5.
2. Which keys are trustworthy enough to block on in C4C today (phone,
   tax number, commercial register)? Their fill rate decides how much
   name-based blocking we need.
