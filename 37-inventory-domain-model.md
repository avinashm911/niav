# NiavERP — Inventory Domain Model (Conceptual)

> Phase 3. Single owner of quantity truth. No valuation, no GST, no SQL, no workflows beyond movement semantics.
> Authority: Phase 1 ownership (`14`), consequence boundaries (`21`), lineage (`16`); Phase 2 posting/idempotency/reversal (`27`,`31`).

## Terms (definition / owner / identity / lifecycle / relationships / mutability / lineage / NOT-synonyms)

### Item (consumed, not owned)
- Definition: goods identity from Item Master. Inventory consumes identity + stockability flag only.
- Owner: Item Master. Inventory must not create/edit items.
- Identity: stable item ID per company.
- Lifecycle: n/a for Inventory (reads active/retired state for validation).
- Relationships: Stock Movement → 1 Item; Item Group/Unit/Tax-hook irrelevant to quantity truth.
- Mutable: nothing by Inventory. NOT-synonym: Stock Item (see below) is not Item itself.

### Stock Item (eligibility view)
- Definition: an Item flagged stock-tracked in master data. Only Stock Items may appear in stock movements.
- Owner: Item Master (flag); Inventory (enforcement at validation).
- Identity: = Item ID + stockability-at-time.
- Lifecycle: flagged → tracked → (unflagged prospectively; history retained).
- Relationships: Movement validation reads flag.
- Mutable: flag changes are master edits (audited), prospective only. NOT-synonym: non-stock/service item.

### Location / Warehouse
- Definition: Location = canonical place dimension per company (`20`, `39`). Warehouse = Location subtype with storage semantics. No Branch ledger concept.
- Owner: Warehouse / Location (definitions). Inventory consumes location IDs for movement dimensions.
- Identity: stable location ID per company.
- Lifecycle: created → active → retired (no new movements; history retained).
- Relationships: Movement → location context (1 for receipt/issue/adjust, from→to for transfer).
- Mutable: nothing by Inventory. NOT-synonym: stock balance; godown label ≠ stock truth.

### Stock Ledger
- Definition: the immutable posted movement truth. All quantity facts live here as movements; balances derive from it.
- Owner: Inventory.
- Identity: ledger = ordered set of Stock Movement identities per company (no separate ledger ID).
- Lifecycle: appended only (posted → never edited; neutralised via reversals).
- Relationships: Ledger ↔ Postings/Sources (N↔1 per posting); Ledger → Balances (derived).
- Mutable: none. NOT-synonym: balance table, Item master quantity field.

### Stock Movement
- Definition: one immutable directed quantity fact (item + location context + quantity + type + source/posting refs). See `38` for representation (direction-enum + strictly positive quantity — chosen canonical).
- Owner: Inventory (rows); created only via Engine posting fan-out.
- Identity: stable movement ID per posted leg (transfer = 2 movement IDs under 1 transfer source).
- Lifecycle: posted immutable → (neutralised by reversal movement, linked).
- Relationships: Movement → 1 Source + 1 Posting + 1 Movement Type; Movement → Item + Location context.
- Mutable: none. NOT-synonym: balance edit, transfer intent, audit event.

### Stock Entry / Movement Entry
- Definition: intentionally NOT a separate concept in Phase 3. The Posting’s inventory consequence set is described as movements directly. Do not introduce a second grouping layer.
- Owner: n/a. NOT-synonym: Journal Entry (accounting), Posting (orchestration).

### Stock Balance (derived)
- Definition: deterministic fold over posted movements per (company, item, location). See `40`.
- Owner: Inventory (derived view).
- Identity: none independent (key = company+item+location, recomputed).
- Lifecycle: re-derived continuously; never written.
- Relationships: Balance ← Movements.
- Mutable: n/a (recompute). NOT-synonym: stored quantity column, master field.

### On-hand Quantity
- Definition: derived balance for an item/location = SUM(in) − SUM(out) over posted movements (incl. openings, receipts, issues, transfers, adjustments, reversals). The only quantity guaranteed in V1.
- Owner: Inventory (derived). NOT-synonym: available-for-promise, physical count without lineage.

### Available Quantity
- Definition: V1 = On-hand (no reservation model). If a future phase justifies reservations, Available = On-hand − Reserved becomes a new derived view with its own lifecycle; until then the term aliases On-hand and must not be stored separately.
- Owner: Inventory (derived alias). NOT-synonym: a separate reservable bucket.

### Reserved Quantity
- Definition: DEFERRED. No reservation concept in Phase 3 (no hold/allocate/release lifecycle). Explicitly not modelled to avoid phantom buckets. Future need requires revisiting movement semantics + identity (see `48`).
- Owner: n/a (deferred).

### In-transit Quantity
- Definition: DEFERRED. Transfers are modelled as atomic paired movements with no lingering transit state (see `42`). No in-transit bucket in Phase 3. A future logistics need (dispatch→receive across time/devices) would add explicit transit states + identity; not invented now.
- Owner: n/a (deferred).

### Stock Adjustment
- Definition: a governed movement correcting quantity to modelled reality (count correction, damage, expiry write-off as quantity-only where policy allows), with mandatory reason + source. See `41`.
- Owner: Inventory (rows); initiated conceptually via governed actors (roles deferred to Phase 16).
- Identity: stable movement ID + adjustment action ID, flagged `is_adjustment`.
- Lifecycle: requested (reason) → posted (movement) → (reversed/corrected via new movements).
- Relationships: Adjustment Movement → Source (adjustment intent) + reason + audit.
- Mutable: none once posted. NOT-synonym: balance edit, silent fix, valuation write-down (valuation deferred).

### Stock Transfer
- Definition: one logical source moving quantity of one item from source location to destination location, realised as paired movements (out + in) under one transfer identity. See `42`.
- Owner: Inventory (paired rows); intent data owned per `14` by Warehouse/Location, executed only via Engine.
- Identity: stable transfer (source) ID + 2 movement IDs (out/in) linked to it.
- Lifecycle: requested → posted atomically (both legs or neither) → (reversed as paired reversal; corrected as paired reversal + paired replacement).
- Relationships: Transfer Source → 2 Movements; Movements → from/to Locations.
- Mutable: none once posted. NOT-synonym: two independent sales/purchases, transport shipment, in-transit escrow.

### Transfer Request / Intent
- Definition: the pre-post data (from, to, item, qty, unit, reason) awaiting Engine validation/posting. Not a movement until posted.
- Owner: Warehouse / Location (intent data); Engine (validation/execution).
- Identity: = transfer source durable ID (shared with resulting transfer).
- Lifecycle: drafted → pending_sync → posted | rejected. NOT-synonym: posted transfer.

### Opening Stock
- Definition: go-live starting quantity per (item, location), flagged and separable from operations. See `41` + `29`-analogue boundary.
- Owner: Inventory (rows); submitted via Migration/Engine like all postings.
- Identity: stable opening-movement ID per (company, item, location) per go-live, flagged `is_opening`, batch-linked.
- Lifecycle: drafted → validated → posted (opening context) → (corrected only via new linked openings).
- Relationships: Opening Movement → Import/go-live Batch + audit.
- Mutable: none once posted. NOT-synonym: receipt, adjustment, operational movement.

### Stock Reversal
- Definition: additive compensating movement neutralising a posted movement (same item/location, equal quantity, opposite direction) with `reversal_of` link.
- Owner: Inventory (rows); orchestrated by Engine.
- Identity: new movement ID + links.
- Lifecycle: requested (reason + permission conceptually) → posted → audited.
- NOT-synonym: deletion, edit, cancellation-by-removal.

### Stock Correction
- Definition: reversal + replacement under shared correction/action ID (e.g., wrong location posted → reverse at wrong location + post at right location, linked).
- Owner: Inventory (rows); Engine transition.
- Identity: new movement IDs + `corrects/corrected_by` links + shared action ID.
- NOT-synonym: in-place fix.

### Stock Line
- Definition: the per-item-line intent within a multi-item source (e.g., transfer doc with 3 items = 1 source, 3 line intents, each realised as its own movement pair where transfer). Lines are intent decomposition, not movements themselves until posted.
- Owner: originating operational domain (data); Engine (execution); Inventory (resulting rows).
- Identity: stable line intent ID within source.
- NOT-synonym: movement (posted fact).

### Stock-affecting Consequence
- Definition: the Inventory-owned subset of a Posting’s fan-out: the set of stock movements created atomically with that posting’s accounting/tax siblings.
- Owner: Inventory (rows); Engine (atomicity).
- Identity: = movement IDs + posting ID.
- NOT-synonym: accounting leg, tax output.
