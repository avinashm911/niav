-- NiavERP migration 0009: period eligibility enforced at commit time.
-- Ordinary postings resolve to exactly one period from the business date;
-- only open periods accept new postings. Authority-gated adjustment paths
-- are deferred (docs/28, docs/36); when designed they will add an explicit
-- exception channel rather than weakening this guard.

CREATE OR REPLACE FUNCTION check_period_open() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_state TEXT;
BEGIN
  SELECT state INTO v_state FROM periods
  WHERE company_id = NEW.company_id AND id = NEW.period_id;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'INVALID_MASTER_REFERENCE: unknown period %', NEW.period_id;
  ELSIF v_state <> 'open' THEN
    RAISE EXCEPTION 'PERIOD_%: postings rejected in % period %', UPPER(v_state), v_state, NEW.period_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_period_open_postings ON postings;
CREATE TRIGGER trg_period_open_postings BEFORE INSERT ON postings
FOR EACH ROW EXECUTE FUNCTION check_period_open();

DROP TRIGGER IF EXISTS trg_period_open_entries ON journal_entries;
CREATE TRIGGER trg_period_open_entries BEFORE INSERT ON journal_entries
FOR EACH ROW EXECUTE FUNCTION check_period_open();
