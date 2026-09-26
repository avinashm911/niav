-- NiavERP migration 0006: Kacha/Pakka, Sales, Purchase, Payments, Audit, Sync.
-- Authority: docs/77-91 (conversion), docs/92-105 (sales), Phase 8 purchase.
-- Supplier invoice ref is an attribute with company-scoped uniqueness
-- (duplicate detection); NiavERP source/voucher identity stays canonical.
-- Advance = payment with zero application rows (never auto-applied).

CREATE TABLE kacha_docs (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  party_id TEXT NOT NULL,
  series TEXT NOT NULL,
  number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, party_id) REFERENCES parties(company_id, id)
);

CREATE TABLE kacha_lines (
  id TEXT NOT NULL,
  kacha_source TEXT NOT NULL REFERENCES kacha_docs(source_id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  item_id TEXT NOT NULL,
  qty_minor BIGINT NOT NULL CHECK (qty_minor > 0),
  rate_paise BIGINT NOT NULL CHECK (rate_paise >= 0),
  PRIMARY KEY (kacha_source, id),
  FOREIGN KEY (company_id, item_id) REFERENCES items(company_id, id)
);

CREATE TABLE conversion_actions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  target_source TEXT NOT NULL UNIQUE REFERENCES sources(id),
  reversed BOOLEAN NOT NULL DEFAULT FALSE,
  actor_user TEXT NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversion_refs (
  action_id TEXT NOT NULL REFERENCES conversion_actions(id),
  kacha_source TEXT NOT NULL REFERENCES kacha_docs(source_id),
  kacha_line TEXT NOT NULL,
  qty_minor BIGINT NOT NULL CHECK (qty_minor > 0),
  PRIMARY KEY (action_id, kacha_source, kacha_line),
  FOREIGN KEY (kacha_source, kacha_line) REFERENCES kacha_lines(kacha_source, id)
);

CREATE TABLE sales_docs (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  party_id TEXT NOT NULL,
  series TEXT NOT NULL,
  number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, party_id) REFERENCES parties(company_id, id)
);

CREATE TABLE sales_lines (
  id TEXT NOT NULL,
  sale_source TEXT NOT NULL REFERENCES sales_docs(source_id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  item_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  qty_minor BIGINT NOT NULL CHECK (qty_minor > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  kacha_source TEXT REFERENCES kacha_docs(source_id),
  kacha_line TEXT,
  PRIMARY KEY (sale_source, id),
  FOREIGN KEY (company_id, item_id) REFERENCES items(company_id, id),
  FOREIGN KEY (company_id, location_id) REFERENCES locations(company_id, id)
);

CREATE TABLE purchase_docs (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  party_id TEXT NOT NULL,
  series TEXT NOT NULL,
  number BIGINT NOT NULL,
  supplier_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, party_id) REFERENCES parties(company_id, id),
  UNIQUE (company_id, supplier_ref)
);

CREATE TABLE purchase_lines (
  id TEXT NOT NULL,
  purchase_source TEXT NOT NULL REFERENCES purchase_docs(source_id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  item_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  qty_minor BIGINT NOT NULL CHECK (qty_minor > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  PRIMARY KEY (purchase_source, id),
  FOREIGN KEY (company_id, item_id) REFERENCES items(company_id, id),
  FOREIGN KEY (company_id, location_id) REFERENCES locations(company_id, id)
);

CREATE TABLE payments (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  series TEXT NOT NULL,
  number BIGINT NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','bank','upi','other')),
  method_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_applications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  payment_source TEXT NOT NULL REFERENCES payments(source_id),
  invoice_source TEXT NOT NULL REFERENCES sources(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_apps_invoice ON payment_applications(invoice_source);
CREATE INDEX idx_apps_payment ON payment_applications(payment_source);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  source_id TEXT REFERENCES sources(id),
  kind TEXT NOT NULL,
  actor_user TEXT NOT NULL REFERENCES profiles(id),
  actor_role TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detail JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_audit_source ON audit_events(source_id);
CREATE INDEX idx_audit_company ON audit_events(company_id);

CREATE TABLE sync_outbox (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','acked','rejected','conflicted')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
