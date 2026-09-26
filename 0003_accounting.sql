-- NiavERP migration 0003: Accounting (docs/24-29, docs/34).
-- One chart per company. Ledger rows immutable (see 0008). Balances derived.
-- Legs: debit-xor-credit, positive integer paise. Balance enforced per entry
-- by trigger (TOTAL_DEBITS = TOTAL_CREDITS). Period FK added here; periods
-- referenced by postings too (added as FK after both exist — see below).

CREATE TABLE accounts (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  acc_group TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  system_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, id),
  UNIQUE (company_id, code)
);

CREATE TABLE periods (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed','locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, id),
  CHECK (start_date <= end_date)
);

ALTER TABLE postings
  ADD CONSTRAINT fk_postings_period FOREIGN KEY (company_id, period_id)
  REFERENCES periods(company_id, id);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  posting_id TEXT NOT NULL UNIQUE REFERENCES postings(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  business_date DATE NOT NULL,
  period_id TEXT NOT NULL,
  is_opening BOOLEAN NOT NULL DEFAULT FALSE,
  reverses TEXT REFERENCES journal_entries(id),
  corrects TEXT REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, period_id) REFERENCES periods(company_id, id)
);

CREATE TABLE journal_legs (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES journal_entries(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  account_id TEXT NOT NULL,
  debit BIGINT NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit BIGINT NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  FOREIGN KEY (company_id, account_id) REFERENCES accounts(company_id, id)
);
CREATE INDEX idx_legs_entry ON journal_legs(entry_id);
CREATE INDEX idx_legs_account ON journal_legs(company_id, account_id);

-- Balance rule per entry: enforced at commit of each statement operating on legs.
CREATE OR REPLACE FUNCTION check_entry_balanced() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_dr BIGINT; v_cr BIGINT;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0) INTO v_dr, v_cr
  FROM journal_legs WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id);
  IF v_dr <> v_cr OR v_dr = 0 THEN
    RAISE EXCEPTION 'UNBALANCED_ENTRY: debits % credits % (entry %)', v_dr, v_cr, COALESCE(NEW.entry_id, OLD.entry_id);
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER trg_legs_balanced
AFTER INSERT OR UPDATE OR DELETE ON journal_legs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_entry_balanced();
