-- NiavERP migration 0004: Inventory (docs/37-43, docs/46).
-- Direction-enum + strictly positive qty (no signed quantities, no debit/credit
-- reuse). Balances are derived folds; no balance table exists by design.
-- DENY-negatives and transfer conservation are enforced by the Engine/posting
-- path (application + tests); the CHECK constraints below guard row shape.

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  posting_id TEXT NOT NULL REFERENCES postings(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  item_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('opening','receipt','issue','transfer-out','transfer-in','adjust-in','adjust-out','reversal')),
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  qty_minor BIGINT NOT NULL CHECK (qty_minor > 0),
  business_date DATE NOT NULL,
  is_opening BOOLEAN NOT NULL DEFAULT FALSE,
  is_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
  reversal_of TEXT REFERENCES stock_movements(id),
  transfer_id TEXT,
  reason TEXT,
  actor_user TEXT NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (company_id, item_id) REFERENCES items(company_id, id),
  FOREIGN KEY (company_id, location_id) REFERENCES locations(company_id, id),
  CHECK (
    (type IN ('opening','receipt','transfer-in','adjust-in') AND direction = 'IN') OR
    (type IN ('issue','transfer-out','adjust-out') AND direction = 'OUT') OR
    (type = 'reversal')
  ),
  CHECK (is_adjustment = (type IN ('adjust-in','adjust-out'))),
  CHECK (type <> 'opening' OR is_opening = TRUE)
);
CREATE INDEX idx_mv_posting ON stock_movements(posting_id);
CREATE INDEX idx_mv_item_loc ON stock_movements(company_id, item_id, location_id);
CREATE INDEX idx_mv_source ON stock_movements(source_id);

-- Derived-balance helper (read-only; never a write target).
CREATE OR REPLACE FUNCTION stock_on_hand(p_company TEXT, p_item TEXT, p_loc TEXT)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN qty_minor ELSE -qty_minor END), 0)
  FROM stock_movements
  WHERE company_id = p_company AND item_id = p_item AND location_id = p_loc;
$$;
