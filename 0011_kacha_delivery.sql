-- NiavERP migration 0011: Kacha physical-delivery correction (global rule).
-- LOCKED: Kacha / Delivery Challan posts ONE inventory OUT movement per line
-- (type `delivery`) and no accounting/GST. A later invoice consumes Kacha
-- quantity and posts accounting/GST with NO further movement.
--
-- 1. `delivery` movement type (OUT only).
-- 2. conversion_reversals: additive record restoring convertibility when a
--    converted invoice is reversed (conversion_actions stays immutable).
-- 3. No-double-issue trigger: a posting whose source is a conversion target
--    must not create quantity movements (reversal/return chains use their own
--    sources and are unaffected). Compensating `reversal` rows stay allowed.
-- 4. kacha_lines.location_id: delivery happens at a location (NOT NULL; all
--    databases are pre-deployment scratch rebuilt by freshDb).

-- 1+4a. Rebuild the type/direction CHECKs to include `delivery`.
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'stock_movements'::regclass AND contype = 'c' LOOP
    EXECUTE format('ALTER TABLE stock_movements DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('opening','receipt','issue','delivery','transfer-out','transfer-in','adjust-in','adjust-out','reversal'));
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_direction_check
  CHECK (direction IN ('IN','OUT'));
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_direction_check CHECK (
  (type IN ('opening','receipt','transfer-in','adjust-in') AND direction = 'IN') OR
  (type IN ('issue','delivery','transfer-out','adjust-out') AND direction = 'OUT') OR
  (type = 'reversal')
);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_qty_check CHECK (qty_minor > 0);
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_adjustment_check
  CHECK (is_adjustment = (type IN ('adjust-in','adjust-out')));
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_opening_check
  CHECK (type <> 'opening' OR is_opening = TRUE);

-- 4b. Delivery location on Kacha lines.
ALTER TABLE kacha_lines ADD COLUMN location_id TEXT;
ALTER TABLE kacha_lines ADD CONSTRAINT fk_kacha_lines_location
  FOREIGN KEY (company_id, location_id) REFERENCES locations(company_id, id);
-- Backfill guard: no rows may exist without a location (fresh scratch DBs).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM kacha_lines WHERE location_id IS NULL) THEN
    RAISE EXCEPTION 'KACHA_LOCATION: existing kacha_lines lack location_id';
  END IF;
END $$;
ALTER TABLE kacha_lines ALTER COLUMN location_id SET NOT NULL;

-- 2. Additive conversion-reversal record (convertibility restoration).
-- (conversion_actions.reversed is dropped: reversal is a row, not a flag.)
ALTER TABLE conversion_actions DROP COLUMN IF EXISTS reversed;
CREATE TABLE conversion_reversals (
  action_id TEXT PRIMARY KEY REFERENCES conversion_actions(id),
  reversal_source TEXT NOT NULL REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  actor_user TEXT NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remaining-quantity view: delivered − accepted (non-reversed) converted.
CREATE OR REPLACE VIEW kacha_remaining AS
SELECT kl.kacha_source, kl.id AS line_id, kl.company_id,
       kl.qty_minor - COALESCE((
         SELECT SUM(cr.qty_minor) FROM conversion_refs cr
         WHERE cr.kacha_source = kl.kacha_source AND cr.kacha_line = kl.id
           AND NOT EXISTS (SELECT 1 FROM conversion_reversals r WHERE r.action_id = cr.action_id)
       ), 0) AS remaining
FROM kacha_lines kl;

-- 3. No second physical movement for already-delivered Kacha quantity.
CREATE OR REPLACE FUNCTION trg_no_double_issue() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversion_actions WHERE target_source = NEW.source_id)
     AND NEW.type IN ('opening','receipt','issue','delivery','transfer-out','transfer-in','adjust-in','adjust-out') THEN
    RAISE EXCEPTION 'DOUBLE_ISSUE: conversion target % must not create another % movement (delivery already moved at Kacha time)', NEW.source_id, NEW.type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_no_double_issue ON stock_movements;
CREATE TRIGGER trg_no_double_issue BEFORE INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION trg_no_double_issue();

-- Tenant RLS on the new table (same convention as 0007/0008).
ALTER TABLE conversion_reversals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON conversion_reversals;
CREATE POLICY tenant_isolation ON conversion_reversals FOR ALL TO app_user
  USING (company_id = NULLIF(current_setting('app.company_id', true), ''));
REVOKE INSERT, UPDATE, DELETE ON conversion_reversals FROM app_user;

-- Immutability: reversal records are additive history (no edits).
DROP TRIGGER IF EXISTS trg_immutable ON conversion_reversals;
CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON conversion_reversals
FOR EACH ROW EXECUTE FUNCTION reject_posted_mutation();
