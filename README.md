<div align="center">
  <h1>Repo.io · Master Data Platform</h1>
  <p><strong>An MDM platform for data mastering, matching, stewardship, governance and quality. Built on the OpenMetadata foundation.</strong></p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="Apache License 2.0"/></a>
    <img src="https://img.shields.io/badge/version-1.0.0--SNAPSHOT-blue" alt="version"/>
    <img src="https://img.shields.io/badge/java-17-orange" alt="java"/>
    <img src="https://img.shields.io/badge/python-3.11-blue" alt="python"/>
    <img src="https://img.shields.io/badge/node-20-brightgreen" alt="node"/>
  </p>
</div>

---

## What is Repo.io

Repo.io governs the **golden records** across every system Nahdet Misr runs on.
Where OpenMetadata governs *metadata*, Repo.io governs the data itself:
one trusted customer, vendor and product record built from SAP C4C,
SAP ERP, SQL Server and Excel/CSV.

## Repository layout

| Module | Purpose |
|---|---|
| [repoio-spec](repoio-spec) | JSON Schema contract |
| [repoio-sdk](repoio-sdk) | Python · Java · TypeScript SDKs |
| [common](common) | Shared Java utilities |
| [docker](docker) | Compose files and base images |
| [repoio-shaded-deps](repoio-shaded-deps) | Shaded dependency bundle |
| [repoio-service](repoio-service) | Dropwizard backend |
| [repoio-airflow-apis](repoio-airflow-apis) | Airflow extension APIs |
| [repoio-k8s-operator](repoio-k8s-operator) | Kubernetes operator |
| [repoio-integration-tests](repoio-integration-tests) | End-to-end tests |
| [repoio-mcp](repoio-mcp) | Model Context Protocol server |
| [repoio-ui-core-components](repoio-ui-core-components) | React component library |
| [repoio-ui](repoio-ui) | React frontend |
| [repoio-dist](repoio-dist) | Release packaging |
| [repoio-clients](repoio-clients) | Python · Java · TypeScript · Go clients |
| [ingestion](ingestion) | Python ingestion framework + connectors |
| [bin · bootstrap · conf · scripts](bin) | Operational scripts |
| [docs](docs) | Architecture · deployment · UI design |

## Quick start

```bash
git clone https://github.com/Moda141/Repo.io.git
cd Repo.io
make start
open http://localhost:8585
```

See [DEVELOPER.md](DEVELOPER.md) for a full developer guide.

## Project status

- ✅ 1.0 — Core MDM for Customers, Vendors
- 🚧 1.1 — Product repository + Splink matching improvements

## License

Apache 2.0 — see [LICENSE](LICENSE).

<sub>Based on the structure of [OpenMetadata](https://github.com/open-metadata/OpenMetadata). Built at Nahdet Misr Publishing Group.</sub>
