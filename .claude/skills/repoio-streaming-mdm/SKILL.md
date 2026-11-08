---
name: repoio-streaming-mdm
description: Use when working on Repo.io stream processing and master-data logic — Spark Structured Streaming jobs, standardisation, Great Expectations data quality, Splink entity matching, survivorship rules, change_log generation, or any M3 work. Trigger on tasks touching repoio-stream, matched_pairs, golden record computation, survivorship, or questions like "how do we merge duplicate customers".
---

# Repo.io Streaming & MDM Processing (M3)

## What this domain owns

- `repoio-stream/` — Spark Structured Streaming jobs (Scala or PySpark):
  standardise → DQ → match → survivorship.
- The topic-to-topic pipeline:

```
raw.<entity> → [standardise] → staged.<entity>
staged.<entity> → [DQ] → (pass/fail routing)
staged.<entity> → [Splink match] → matched.<entity>
matched.<entity> → [survivorship] → golden.<entity> + changes.<entity>
```

- Writes to Iceberg: `staged_customer`, `matched_pairs`,
  `golden_customer`, `change_log`. Emits `changes.<entity>` to Kafka
  (audit log + outbox for SAP C4C).

## Non-negotiables

1. **One job per stage.** Standardise, DQ, match and survivorship are
   separate streaming jobs with their own checkpoints — not one monolith.
   Failures must isolate; a DQ schema change must not halt matching.
2. **Splink owns matching.** Configure and evaluate Splink; do not
   hand-roll fuzzy matching. Matching runs on `staged.` data and emits
   scored candidate pairs to `matched_pairs` — pairing decisions remain
   auditable.
3. **Match quality is a deliverable, not a vibe.** M3's exit gate includes
   precision/recall evaluation on labelled pairs (Splink's evaluation
   tooling). A pipeline that runs but over-merges is a failed pipeline —
   over-merging customers is a business-visible error.
4. **Survivorship rules are configuration.** Which source wins per field
   is config (versioned, reviewable), not code branches. Every field-level
   decision writes to `change_log` with provenance — if you can't answer
   "why is this field this value", the design is wrong.
5. **Great Expectations owns DQ.** Validation happens between standardise
   and match. Failures route to a dead-letter/review path — never dropped
   silently, never blocking the whole stream.
6. **State discipline.** Streaming state must be bounded; matching windows
   and any dedup state need explicit sizing and eviction, or the job will
   OOM in production no matter how well it behaves locally.

## Implementation notes

- Exactly-once effect: idempotent writes keyed on
  `(source_id, version)`; checkpointing per job; Iceberg as the sink.
- Survivorship emits both the new `golden.` row and the field-level diff
  to `changes.<entity>` — the outbox contract downstream systems rely on.
- Run jobs against the dev compose stack (kafka + iceberg + spark) —
  local-only unit tests with mocked sources cannot catch serialization or
  checkpoint bugs.

## Verification (must pass before "done")

- End-to-end: synthetic-but-realistic customer events flow
  `raw → staged → matched → golden`, and `change_log` rows appear with
  provenance (the M3 exit condition).
- A known duplicate pair merges; a known distinct pair does not — with the
  labelled-pair precision/recall report attached.
- DQ failure case routes to the review path, not the golden path.
- Job restart from checkpoint does not duplicate golden rows.

## Common pitfalls

- Hardcoding survivorship precedence in Scala/Python instead of config.
- Evaluating match quality only on the happy-path pairs.
- One giant job "for simplicity" — undo this immediately.
- Unbounded groupBy state "working" in dev volumes.
