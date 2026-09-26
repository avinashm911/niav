-- NiavERP migration 0001: tenancy + masters.
-- Authority: docs/13, docs/14, docs/20. Company = tenant. Party = single
-- identity with role views. Warehouse = Location subtype flag. No balances stored.
-- Conventions: durable TEXT ids (client-generated UUIDs), company scoping on
-- every tenant row, created_at timestamptz default now().

CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  company_id TEXT NOT NULL REFERENCES companies(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL CHECK (role IN ('owner','accountant','biller','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);

CREATE TABLE parties (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  gstin TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  merged_into TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, id),
  FOREIGN KEY (company_id, merged_into) REFERENCES parties(company_id, id)
);

CREATE TABLE party_roles (
  company_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','supplier')),
  PRIMARY KEY (company_id, party_id, role),
  FOREIGN KEY (company_id, party_id) REFERENCES parties(company_id, id)
);

CREATE TABLE items (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty_scale SMALLINT NOT NULL DEFAULT 0 CHECK (qty_scale BETWEEN 0 AND 3),
  stock_tracked BOOLEAN NOT NULL DEFAULT TRUE,
  tax_category TEXT NOT NULL,
  hsn TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, id)
);

CREATE TABLE locations (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  warehouse BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, id)
);
