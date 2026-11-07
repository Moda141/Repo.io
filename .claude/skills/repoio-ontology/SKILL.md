---
name: repoio-ontology
description: Use when working on the Repo.io semantic layer — the ontology service, RDF/OWL modeling, SPARQL endpoints, SHACL validation, Jena/Fuseki/TDB2, reasoning configuration, or the ontology browser UI. Trigger on tasks touching repoio-ontology, business concepts/glossary/semantic relationships, SPARQL queries, SHACL shapes, or requests to model "what entities mean and how they relate".
---

# Repo.io Ontology & Semantic Layer

## What this domain owns

- `repoio-ontology/` — the Repo.io integration service: ontology
  lifecycle, authorization, versioning, API façade.
- Apache Jena: RDF model APIs, ontology APIs, SPARQL, SHACL, inference.
- Jena Fuseki — SPARQL HTTP endpoint for query/update.
- TDB2 — persistent RDF dataset storage (initial deployment).
- OpenUI5 ontology browser/editor + optional Cytoscape.js visualization.

## The boundary that keeps this healthy

The ontology is one voice in a choir — each system answers a different
question, and the ontology must not absorb the others' jobs:

- **MDM** answers: which records represent the same real-world entity?
- **Ontology** answers: what do these concepts mean and how are they
  related?
- **Catalog (OpenMetadata / repoio-catalog)** answers: where is the asset
  and what metadata describes it?
- **Workflow (Flowable)** answers: which process and approvals run?

Concrete consequences: ontology concepts **link to** canonical Repo.io
entity IDs, glossary terms, KPIs and catalog assets — they never mirror
entity tables or catalog inventories. OpenMetadata remains the
governance/catalog capability where adopted: integrate with its glossary,
domains, ownership and asset references instead of duplicating them.
Flowable may orchestrate ontology approval workflows; it is never the
ontology store.

## Non-negotiables

1. **Reasoning is deliberately bounded.** Support a documented RDFS/OWL
   profile with published performance limits. Never promise full OWL 2 DL
   reasoning from the Jena setup. If description-logic reasoning becomes a
   real requirement, propose evaluating a dedicated reasoner (e.g. HermiT
   via OWLAPI) as a separate, benchmarked decision.
2. **The reasoner sits behind an adapter** so the engine can be swapped
   without changing Repo.io APIs.
3. **SPARQL is served through Repo.io authentication and authorization.**
   The secured endpoint is the only path. AI agents query semantics via
   permission-filtered MCP tools — never an unrestricted Fuseki endpoint.
4. **`repoio-service` remains the system of record** for business
   entities and permissions; the ontology stores semantic
   representations and links back to canonical IDs.
5. **Changes are versioned and reviewed.** Ontology namespaces, classes,
   properties and relationships change through review/approval with audit
   — Turtle/RDF-XML import/export round-trips losslessly.
6. **SHACL for agreed business constraints** — validation shapes are
   themselves versioned artifacts, not ad-hoc scripts.

## V1 scope (from the architecture)

- Namespaces, classes, object/data properties, relationships.
- Import/export in Turtle and RDF/XML.
- Versioned changes with review/approval and audit.
- SPARQL read/query API behind Repo.io authn/authz.
- SHACL validation for agreed constraints.
- Bounded RDFS/OWL reasoning profile, documented.
- Links from concepts to entity IDs, glossary terms, KPIs, catalog
  assets.

## Verification (must pass before "done")

- Turtle import → export round-trips without loss.
- SPARQL queries return correct results through the secured endpoint;
  unauthenticated/unauthorized requests are denied.
- SHACL validation catches a deliberately broken instance.
- Reasoning runs within documented limits on a representative graph —
  benchmark before production sizing (graph size, query patterns,
  concurrency).
- A versioned change leaves a reviewable diff and audit entry.

## Common pitfalls

- Letting the ontology drift into a shadow catalog or a second entity
  store — the boundary in the section above exists precisely to prevent
  this.
- Enabling "just a bit more" reasoning without benchmarking — performance
  cliffs in OWL reasoning are steep and sudden.
- Exposing Fuseki directly "for internal tools".
- Unnamespaced ad-hoc properties accumulating in the graph.
