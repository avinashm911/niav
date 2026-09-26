-- NiavERP migration 0005: GST (docs/49-54, docs/60).
-- Rates live ONLY in versioned configuration rows. No literals in code paths.
-- Determinations pin their config version; history never re-resolved.

CREATE TABLE gst_configs (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE TABLE gst_rates (
  config_id TEXT NOT NULL REFERENCES gst_configs(id),
  rate_ref TEXT NOT NULL,
  components TEXT[] NOT NULL,
  bps_cgst INTEGER NOT NULL DEFAULT 0 CHECK (bps_cgst >= 0),
  bps_sgst INTEGER NOT NULL DEFAULT 0 CHECK (bps_sgst >= 0),
  bps_igst INTEGER NOT NULL DEFAULT 0 CHECK (bps_igst >= 0),
  bps_utgst INTEGER NOT NULL DEFAULT 0 CHECK (bps_utgst >= 0),
  bps_cess INTEGER NOT NULL DEFAULT 0 CHECK (bps_cess >= 0),
  PRIMARY KEY (config_id, rate_ref)
);

CREATE TABLE gst_registrations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  jurisdiction TEXT NOT NULL,
  gstin TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('applied','active','suspended','cancelled')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gst_determinations (
  id TEXT PRIMARY KEY,
  posting_id TEXT NOT NULL REFERENCES postings(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  supply_class TEXT NOT NULL CHECK (supply_class IN ('taxable','exempt','nil-rated','non-gst','zero-rated')),
  rate_ref TEXT NOT NULL,
  config_version TEXT NOT NULL REFERENCES gst_configs(version),
  taxable_paise BIGINT NOT NULL CHECK (taxable_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gst_tax_lines (
  id TEXT PRIMARY KEY,
  determination_id TEXT NOT NULL REFERENCES gst_determinations(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  role TEXT NOT NULL CHECK (role IN ('CGST','SGST','IGST','UTGST','CESS')),
  rate_ref TEXT NOT NULL,
  config_version TEXT NOT NULL,
  basis_paise BIGINT NOT NULL CHECK (basis_paise >= 0),
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  UNIQUE (determination_id, role)
);
CREATE INDEX idx_taxlines_det ON gst_tax_lines(determination_id);
