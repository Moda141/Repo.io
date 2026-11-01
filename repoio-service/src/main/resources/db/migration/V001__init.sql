CREATE TABLE domain (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE repository (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  domain_id UUID NOT NULL REFERENCES domain(id),
  model_id UUID,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE golden_record (
  id UUID PRIMARY KEY,
  golden_id TEXT NOT NULL UNIQUE,
  repository_id UUID NOT NULL REFERENCES repository(id),
  parent_id UUID REFERENCES golden_record(id),
  status TEXT NOT NULL,
  quality_score NUMERIC(5,2),
  attributes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX golden_record_repo_idx ON golden_record(repository_id);
CREATE INDEX golden_record_parent_idx ON golden_record(parent_id);
CREATE TABLE source (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  role TEXT NOT NULL,
  config JSONB NOT NULL
);
CREATE TABLE pipeline (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES source(id),
  repository_id UUID REFERENCES repository(id),
  schedule TEXT,
  mode TEXT
);
CREATE TABLE pipeline_run (
  id UUID PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES pipeline(id),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  log TEXT
);
CREATE TABLE change_request (
  id UUID PRIMARY KEY,
  cr_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  repository_id UUID NOT NULL REFERENCES repository(id),
  requester_id UUID NOT NULL,
  state TEXT NOT NULL,
  fields JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id UUID,
  before JSONB,
  after JSONB,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
