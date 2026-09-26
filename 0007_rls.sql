-- NiavERP migration 0007: tenant isolation via Row-Level Security.
-- Enforcement uses session settings (app.company_id / app.user_id) so it is
-- testable on vanilla PostgreSQL AND portable to Supabase (where the same
-- policies are extended with auth.jwt() claims; that mapping is deferred
-- until a Supabase project exists — see docs/107 checkpoint report).
-- A restricted role `app_user` is used by tests; table owners bypass RLS,
-- so tests must SET ROLE app_user to exercise the policies.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_dev_only';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Tenant tables: every row carries company_id; policy requires a session
-- company match. Membership-gated reads are application-enforced (role checks
-- in the Engine); the DB guarantees no cross-company access.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'parties','party_roles','items','locations','accounts','periods',
    'sources','vouchers','postings','journal_entries','journal_legs',
    'stock_movements','gst_determinations','gst_tax_lines',
    'kacha_docs','kacha_lines','conversion_actions',
    'sales_docs','sales_lines','purchase_docs','purchase_lines',
    'payments','payment_applications','audit_events','sync_outbox'
  ] LOOP
    -- NOTE: conversion_refs gains company_id in 0008; its policy is created there.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_user USING (company_id = NULLIF(current_setting(''app.company_id'', true), '''') )',
      t);
  END LOOP;
END $$;

-- gst_configs / gst_rates / companies / profiles / memberships / series_counters:
-- companies+profiles are identity roots (readable); memberships gate access at
-- the app layer; configs are shared statutory data (no company scope by design);
-- series_counters are Engine-internal (service-side only, no direct app writes).
-- No RLS on these by design; documented here so the choice is explicit.
