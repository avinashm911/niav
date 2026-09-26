-- NiavERP migration 0008: posted-record protection + conversion_refs tenancy.
-- Posted financial/business truth is append-only: corrections and reversals
-- are new rows (approved model docs/31, docs/41, docs/56). Direct UPDATE or
-- DELETE of committed rows is rejected at the database level.
-- conversion_refs gains company_id so tenant RLS covers the full graph.

ALTER TABLE conversion_refs ADD COLUMN company_id TEXT REFERENCES companies(id);

-- Backfill (fresh DB: no rows; statement kept for correctness on rebuilds).
UPDATE conversion_refs r SET company_id = a.company_id
FROM conversion_actions a WHERE a.id = r.action_id AND r.company_id IS NULL;

ALTER TABLE conversion_refs ALTER COLUMN company_id SET NOT NULL;

CREATE OR REPLACE FUNCTION reject_posted_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'POSTED_IMMUTABLE: % % forbidden (use reversal/correction)', TG_TABLE_NAME, TG_OP;
  RETURN NULL;
END $$;

-- Full immutability (no UPDATE, no DELETE): sources, vouchers, postings,
-- journal entries/legs, stock movements, GST determinations/lines, audit.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sources','vouchers','postings',
    'journal_entries','journal_legs',
    'stock_movements',
    'gst_determinations','gst_tax_lines',
    'audit_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_immutable ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_posted_mutation()', t);
  END LOOP;
END $$;

-- Commercial documents: identity rows immutable once referenced; quantity
-- facts (lines/refs/applications) append-only. Enforce no-UPDATE/DELETE on
-- the line/ref/application tables; document headers may only transition via
-- new sources (application enforces; headers locked here too for safety).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kacha_docs','kacha_lines','conversion_actions','conversion_refs',
    'sales_docs','sales_lines','purchase_docs','purchase_lines',
    'payments','payment_applications','sync_outbox'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_immutable ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_posted_mutation()', t);
  END LOOP;
END $$;

-- NOTE: series_counters.last_number is the sole sanctioned mutable counter
-- (incremented only by next_voucher_number() inside posting transactions).
-- Masters (parties/items/locations/accounts/periods states/memberships) stay
-- governable via application-audited edits; locked in a later checkpoint if
-- the audit model requires trigger-level journalling.

-- Tenant RLS for conversion_refs (company_id added above).
ALTER TABLE conversion_refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON conversion_refs;
CREATE POLICY tenant_isolation ON conversion_refs FOR ALL TO app_user
  USING (company_id = NULLIF(current_setting('app.company_id', true), ''));
