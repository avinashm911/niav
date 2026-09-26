-- NiavERP migration 0010: server-side authorization (Checkpoint 3).
-- Authority: docs/07 (server enforcement, least privilege, fail closed).
--
-- Session identity convention (pre-Supabase-Auth stand-in, documented):
--   SET ROLE app_user;
--   SET app.user_id / app.company_id / app.role / app.device_id;
-- When Supabase Auth lands, app.user_id <- auth.uid() and membership/role
-- resolve the same way; the checks below do not change shape.
--
-- Service bypass: connections as superuser `postgres` WITHOUT app.user_id set
-- are the service_role equivalent (migrations, seeds, owner-side tests).
-- It is unreachable to application clients (no superuser credentials leave
-- the server). All app_user paths are fully checked.

-- Membership role of the session user in the session company (or NULL).
CREATE OR REPLACE FUNCTION app_session_role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT m.role FROM memberships m
  WHERE m.user_id = NULLIF(current_setting('app.user_id', true), '')
    AND m.company_id = NULLIF(current_setting('app.company_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_is_service() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT current_user = 'postgres'
    AND NULLIF(current_setting('app.user_id', true), '') IS NULL;
$$;

-- Poster roles: owner (full), accountant (books/tax), biller (commercial
-- create). Viewer is read-only everywhere. Unknown/unsupported -> deny.
CREATE OR REPLACE FUNCTION app_require_poster(p_company TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_role TEXT;
BEGIN
  IF app_is_service() THEN RETURN; END IF;
  IF p_company IS DISTINCT FROM NULLIF(current_setting('app.company_id', true), '') THEN
    RAISE EXCEPTION 'INVALID_COMPANY_CONTEXT: session company does not match row company';
  END IF;
  v_role := app_session_role();
  IF v_role IS NULL OR v_role NOT IN ('owner','accountant','biller') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: poster role required (have %)', COALESCE(v_role, 'none');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION app_require_owner(p_company TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_role TEXT;
BEGIN
  IF app_is_service() THEN RETURN; END IF;
  IF p_company IS DISTINCT FROM NULLIF(current_setting('app.company_id', true), '') THEN
    RAISE EXCEPTION 'INVALID_COMPANY_CONTEXT: session company does not match row company';
  END IF;
  v_role := app_session_role();
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: owner role required (have %)', COALESCE(v_role, 'none');
  END IF;
END $$;

-- Master writes (governed, audited at app layer): poster roles only.
CREATE OR REPLACE FUNCTION trg_master_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_company TEXT;
BEGIN
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  PERFORM app_require_poster(v_company);
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['parties','party_roles','items','locations','accounts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_authz ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_authz BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_master_guard()', t);
  END LOOP;
END $$;

-- Owner-only writes: periods, memberships, statutory configuration.
-- Two functions: row-company tables vs global (company-less) tables, so no
-- trigger ever references a field its table does not have.
CREATE OR REPLACE FUNCTION trg_owner_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_company TEXT;
BEGIN
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  PERFORM app_require_owner(v_company);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION trg_owner_guard_global() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM app_require_owner(NULLIF(current_setting('app.company_id', true), ''));
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['periods','memberships'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_authz_owner ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_authz_owner BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_owner_guard()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['gst_configs','gst_rates'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_authz_owner ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_authz_owner BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION trg_owner_guard_global()', t);
  END LOOP;
END $$;

-- Consequence tables: NO direct writes for app_user. All posted truth flows
-- through api_post_bundle() (SECURITY DEFINER) which enforces membership,
-- roles, periods, balance, availability, GST structure and audit atomically.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sources','vouchers','postings','series_counters',
    'journal_entries','journal_legs',
    'stock_movements',
    'gst_determinations','gst_tax_lines',
    'kacha_docs','kacha_lines','conversion_actions','conversion_refs',
    'sales_docs','sales_lines','purchase_docs','purchase_lines',
    'payments','payment_applications','audit_events','sync_outbox'
  ] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I FROM app_user', t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION next_voucher_number(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION next_voucher_number(TEXT, TEXT) FROM app_user;

-- Server-side posting RPC. Runs as owner; enforces everything itself.
-- Payload: {company_id, kind, series, business_date, source_id?,
--   legs:[{code,debit,credit}], movements:[{item,loc,type,direction,qty,reason?}],
--   gst:[{supply_class,intra_state,rate_ref,taxable}], audit_kind?}
CREATE OR REPLACE FUNCTION api_post_bundle(p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user TEXT := NULLIF(current_setting('app.user_id', true), '');
  v_company TEXT := NULLIF(current_setting('app.company_id', true), '');
  v_device TEXT := COALESCE(NULLIF(current_setting('app.device_id', true), ''), 'db');
  v_role TEXT;
  v_p_company TEXT := p_payload->>'company_id';
  v_source TEXT := COALESCE(p_payload->>'source_id', 'srv-' || md5(random()::text || clock_timestamp()::text));
  v_series TEXT := p_payload->>'series';
  v_bdate DATE := (p_payload->>'business_date')::DATE;
  v_period TEXT; v_posting TEXT; v_voucher TEXT; v_number BIGINT;
  v_leg JSONB; v_mv JSONB; v_g JSONB;
  v_dr BIGINT := 0; v_cr BIGINT := 0;
  v_acc TEXT; v_entry TEXT;
  v_avail BIGINT;
  v_rate RECORD; v_det TEXT; v_role2 TEXT; v_bps INT; v_amt BIGINT;
  v_want TEXT[]; v_cfgver TEXT;
BEGIN
  IF v_user IS NULL OR v_company IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: no authenticated session';
  END IF;
  IF v_p_company IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'INVALID_COMPANY_CONTEXT: payload company does not match session';
  END IF;
  SELECT m.role INTO v_role FROM memberships m WHERE m.user_id = v_user AND m.company_id = v_company;
  IF v_role IS NULL OR v_role NOT IN ('owner','accountant','biller') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: poster role required (have %)', COALESCE(v_role, 'none');
  END IF;
  IF v_role = 'viewer' THEN RAISE EXCEPTION 'UNAUTHORIZED: viewers are read-only'; END IF;

  -- Idempotent converge: same source returns originals.
  SELECT p.id INTO v_posting FROM postings p WHERE p.source_id = v_source;
  IF FOUND THEN
    SELECT v.number INTO v_number FROM vouchers v WHERE v.source_id = v_source;
    RETURN jsonb_build_object('posting_id', v_posting, 'voucher_number', v_number, 'deduped', true);
  END IF;

  SELECT per.id INTO v_period FROM periods per
  WHERE per.company_id = v_company AND v_bdate BETWEEN per.start_date AND per.end_date;
  IF v_period IS NULL THEN RAISE EXCEPTION 'INVALID_DATE: no period covers %', v_bdate; END IF;

  v_posting := 'pst-' || md5(v_source);
  v_voucher := 'vch-' || md5(v_source);
  v_number := next_voucher_number(v_company, v_series);

  INSERT INTO sources(id,company_id,kind,series_intent,business_date,actor_user,actor_role,device_id,client_ts)
  VALUES (v_source, v_company, COALESCE(p_payload->>'kind','sale'), v_series, v_bdate, v_user, v_role, v_device, now());
  INSERT INTO vouchers(id,source_id,company_id,series,number) VALUES (v_voucher, v_source, v_company, v_series, v_number);
  INSERT INTO postings(id,source_id,voucher_id,company_id,period_id) VALUES (v_posting, v_source, v_voucher, v_company, v_period);

  -- Accounting legs (balance enforced here AND by deferred trigger).
  IF COALESCE(jsonb_array_length(p_payload->'legs'), 0) > 0 THEN
    v_entry := 'ent-' || md5(v_source);
    INSERT INTO journal_entries(id,posting_id,source_id,company_id,business_date,period_id)
    VALUES (v_entry, v_posting, v_source, v_company, v_bdate, v_period);
    FOR v_leg IN SELECT * FROM jsonb_array_elements(p_payload->'legs') LOOP
      SELECT a.id INTO v_acc FROM accounts a
      WHERE a.company_id = v_company AND a.code = v_leg->>'code' AND a.active;
      IF v_acc IS NULL THEN RAISE EXCEPTION 'ACCOUNTING_VALIDATION_FAILED: unknown/retired account %', v_leg->>'code'; END IF;
      IF NOT (((v_leg->>'debit')::BIGINT > 0 AND (v_leg->>'credit')::BIGINT = 0) OR ((v_leg->>'credit')::BIGINT > 0 AND (v_leg->>'debit')::BIGINT = 0)) THEN
        RAISE EXCEPTION 'ACCOUNTING_VALIDATION_FAILED: leg must be debit-xor-credit positive';
      END IF;
      v_dr := v_dr + (v_leg->>'debit')::BIGINT; v_cr := v_cr + (v_leg->>'credit')::BIGINT;
      INSERT INTO journal_legs(id,entry_id,company_id,account_id,debit,credit)
      VALUES ('leg-' || md5(v_source || (v_leg->>'code')), v_entry, v_company, v_acc, (v_leg->>'debit')::BIGINT, (v_leg->>'credit')::BIGINT);
    END LOOP;
    IF v_dr <> v_cr OR v_dr = 0 THEN
      RAISE EXCEPTION 'ACCOUNTING_VALIDATION_FAILED: debits % <> credits %', v_dr, v_cr;
    END IF;
  END IF;

  -- Inventory movements (DENY-negatives incl. intra-bundle pairing).
  FOR v_mv IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'movements','[]'::jsonb)) LOOP
    IF (v_mv->>'qty')::BIGINT <= 0 THEN RAISE EXCEPTION 'INVENTORY_VALIDATION_FAILED: bad quantity'; END IF;
    IF (v_mv->>'direction') = 'OUT' THEN
      SELECT stock_on_hand(v_company, v_mv->>'item', v_mv->>'loc') INTO v_avail;
      IF v_avail < (v_mv->>'qty')::BIGINT THEN
        RAISE EXCEPTION 'STOCK_CONFLICT: have %, need %', v_avail, (v_mv->>'qty')::BIGINT;
      END IF;
    END IF;
    INSERT INTO stock_movements(id,posting_id,source_id,company_id,item_id,location_id,type,direction,qty_minor,business_date,reason,actor_user)
    VALUES ('mv-' || md5(v_source || (v_mv->>'item') || (v_mv->>'loc') || (v_mv->>'type')),
      v_posting, v_source, v_company, v_mv->>'item', v_mv->>'loc', v_mv->>'type', v_mv->>'direction',
      (v_mv->>'qty')::BIGINT, v_bdate, v_mv->>'reason', v_user);
  END LOOP;

  -- GST determinations (structure validated against versioned config).
  FOR v_g IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'gst','[]'::jsonb)) LOOP
    IF (v_g->>'supply_class') IN ('exempt','nil-rated','non-gst') THEN
      SELECT c.version INTO v_cfgver FROM gst_configs c
      WHERE v_bdate BETWEEN c.effective_from AND COALESCE(c.effective_to, '9999-12-31'::DATE)
      ORDER BY c.effective_from DESC LIMIT 1;
      IF v_cfgver IS NULL THEN RAISE EXCEPTION 'TAX_CONFIGURATION_STALE: no effective config'; END IF;
      INSERT INTO gst_determinations(id,posting_id,source_id,company_id,supply_class,rate_ref,config_version,taxable_paise)
      VALUES ('det-' || md5(v_source || (v_g->>'rate_ref')), v_posting, v_source, v_company,
        v_g->>'supply_class', v_g->>'rate_ref', v_cfgver, (v_g->>'taxable')::BIGINT);
      CONTINUE;
    END IF;
    SELECT r.components, r.bps_cgst, r.bps_sgst, r.bps_igst, r.bps_utgst, r.bps_cess, c.version INTO v_rate
    FROM gst_rates r JOIN gst_configs c ON c.id = r.config_id
    WHERE r.rate_ref = v_g->>'rate_ref' AND v_bdate BETWEEN c.effective_from AND COALESCE(c.effective_to, '9999-12-31'::DATE);
    IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CONFIGURATION_STALE: no effective rate %', v_g->>'rate_ref'; END IF;
    v_cfgver := v_rate.version;
    v_want := CASE WHEN (v_g->>'intra_state')::BOOLEAN THEN ARRAY['CGST','SGST'] ELSE ARRAY['IGST'] END;
    IF (SELECT array_agg(x ORDER BY x) FROM unnest(v_rate.components) x WHERE x <> 'CESS')
       IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_want) x) THEN
      RAISE EXCEPTION 'GST_VALIDATION_FAILED: rate structure mismatch for %', v_g->>'rate_ref';
    END IF;
    v_det := 'det-' || md5(v_source || (v_g->>'rate_ref'));
    INSERT INTO gst_determinations(id,posting_id,source_id,company_id,supply_class,rate_ref,config_version,taxable_paise)
    VALUES (v_det, v_posting, v_source, v_company, v_g->>'supply_class', v_g->>'rate_ref', v_cfgver, (v_g->>'taxable')::BIGINT);
    FOREACH v_role2 IN ARRAY v_want LOOP
      v_bps := CASE v_role2 WHEN 'CGST' THEN v_rate.bps_cgst WHEN 'SGST' THEN v_rate.bps_sgst WHEN 'IGST' THEN v_rate.bps_igst ELSE v_rate.bps_utgst END;
      v_amt := ((v_g->>'taxable')::BIGINT * v_bps + 5000) / 10000;
      IF (v_g->>'supply_class') = 'zero-rated' THEN v_amt := 0; END IF;
      INSERT INTO gst_tax_lines(id,determination_id,company_id,role,rate_ref,config_version,basis_paise,amount_paise)
      VALUES ('txl-' || md5(v_det || v_role2), v_det, v_company, v_role2, v_g->>'rate_ref', v_cfgver, (v_g->>'taxable')::BIGINT, v_amt);
    END LOOP;
  END LOOP;

  INSERT INTO audit_events(id,company_id,source_id,kind,actor_user,actor_role,device_id,detail)
  VALUES ('aud-' || md5(v_source), v_company, v_source, COALESCE(p_payload->>'audit_kind','post'), v_user, v_role, v_device,
    jsonb_build_object('posting_id', v_posting, 'voucher_number', v_number));
  RETURN jsonb_build_object('posting_id', v_posting, 'voucher_number', v_number, 'deduped', false);
END $$;

GRANT EXECUTE ON FUNCTION api_post_bundle(JSONB) TO app_user;
