# NiavERP — Inventory ↔ Accounting Boundary

> Phase 3. Quantity truth vs money truth. Inventory emits quantity facts for later binding; owns no money.

## 1. Rule

- Inventory owns: stock movements + derived balances. Accounting owns: accounts, entries, debits/credits, balances. Neither writes the other’s truth. The shared Posting is atomic across both (Engine fan-out per `21`, `27§4`): quantity rows and money rows commit together or not at all, each owned on its side with shared source/posting lineage.
- Inventory exposes per posting: movement IDs + item/location/direction/quantity/unit + source/posting refs. Accounting (Phase 3+) will bind money legs by policy in later phases; Phase 3 defines no bindings, no COGS, no valuation, no discounts/round-offs.

## 2. What Inventory never does

Create/select accounts, emit debits/credits, set monetary stock values, compute COGS/valuation, decide tax treatment, define revenue/cost timing.

## 3. What Accounting never does

Create/edit/void stock movements, set quantities, resolve locations, decide IN/OUT direction, bypass Engine to “fix stock via journal”.

## 4. GST note

Inventory preserves source/line lineage (item, quantities, locations, business date, party where present on the source) so Phase 4 can determine tax without re-asking quantity facts. No rates/slabs/calculations here.

## 5. Deferred bindings (→ `48`, later phases)

Valuation method, COGS timing/accounts, stock-account roles, discount/shortage treatment, return-linked quantity+money pairing, and any monetary restatement of corrections — all deferred with balance/lineage discipline inherited from Phase 2/3.
