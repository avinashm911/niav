-- NiavERP migration 0002: Transaction Engine core (docs/63-68, docs/16-18).
-- Sources carry the durable client-generated ID as PRIMARY KEY: the same
-- source ID can never create two transactions (idempotency at the PK level).
-- Voucher numbers are server-assigned via next_voucher_number() which locks
-- the series row (SELECT ... FOR UPDATE); UNIQUE(company,series,number)
-- plus never-recycled discipline (no DELETE path; see 0008 protections).

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  kind TEXT NOT NULL,
  series_intent TEXT NOT NULL,
  business_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_sync'
    CHECK (status IN ('draft','pending_sync','posted','cancelled','reversed','corrected')),
  actor_user TEXT NOT NULL REFERENCES profiles(id),
  actor_role TEXT NOT NULL,
  device_id TEXT NOT NULL,
  client_ts TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sources_company ON sources(company_id);

CREATE TABLE series_counters (
  company_id TEXT NOT NULL REFERENCES companies(id),
  series TEXT NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (company_id, series)
);

CREATE TABLE vouchers (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  series TEXT NOT NULL,
  number BIGINT NOT NULL CHECK (number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, series, number)
);

CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id),
  voucher_id TEXT NOT NULL UNIQUE REFERENCES vouchers(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  period_id TEXT NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed','corrected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_postings_company ON postings(company_id);

-- Atomic, concurrency-safe numbering. Must be called inside the posting
-- transaction; the row lock serialises concurrent claims on one series.
CREATE OR REPLACE FUNCTION next_voucher_number(p_company TEXT, p_series TEXT)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_last BIGINT;
BEGIN
  INSERT INTO series_counters(company_id, series, last_number)
  VALUES (p_company, p_series, 0)
  ON CONFLICT (company_id, series) DO NOTHING;
  SELECT last_number INTO v_last FROM series_counters
  WHERE company_id = p_company AND series = p_series FOR UPDATE;
  UPDATE series_counters SET last_number = v_last + 1
  WHERE company_id = p_company AND series = p_series;
  RETURN v_last + 1;
END $$;
