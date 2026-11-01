.PHONY: bootstrap dev start stop logs lint test test-integration dist \
        build-service build-ui build-ingestion deploy-staging deploy-prod \
        clean help
VERSION := 1.0.0-SNAPSHOT
IMAGE := nahdetmisr/repoio

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-24s\033[0m %s\n", $$1, $$2}'

bootstrap: ## One-time setup: hooks, codegen, docker base images
	@pre-commit install
	@./mvnw -pl repoio-spec generate-sources
	@docker compose -f docker/compose/base.yml pull

dev: ## Start Postgres + ES + Kafka and run service + UI
	@docker compose -f docker/compose/dev.yml up -d
	@$(MAKE) build-service && $(MAKE) run-service &
	@$(MAKE) run-ui

start: ## Start the full stack
	@docker compose -f docker/compose/full.yml up -d

stop: ## Stop the stack
	@docker compose -f docker/compose/full.yml down

logs: ## Tail service logs
	@docker compose -f docker/compose/full.yml logs -f repoio-service

lint: ## Run all linters
	@./mvnw spotless:check
	@cd ingestion && ruff check . && black --check .
	@cd repoio-ui/src/main/resources/ui && yarn lint

test: ## Unit tests
	@./mvnw test
	@cd ingestion && pytest -q
	@cd repoio-ui/src/main/resources/ui && yarn test --watchAll=false

test-integration: ## Integration tests
	@./mvnw -pl repoio-integration-tests verify -Pintegration

build-service:
	@./mvnw -pl repoio-service -am package -DskipTests

build-ui:
	@cd repoio-ui/src/main/resources/ui && yarn install --immutable && yarn build

build-ingestion:
	@cd ingestion && python -m build

dist: build-service build-ui build-ingestion ## Release tarball + Docker image
	@./mvnw -pl repoio-dist package
	@docker build -t $(IMAGE):$(VERSION) -f docker/Dockerfile .

deploy-staging:
	@helm upgrade --install repoio ./charts/repoio -n repoio-staging --set image.tag=$(VERSION)

deploy-prod:
	@helm upgrade --install repoio ./charts/repoio -n repoio --set image.tag=$(VERSION)

clean:
	@./mvnw clean
