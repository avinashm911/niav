// On-device self-test: executes D01–D24 NATIVELY (real expo-sqlite, real
// fetch to the API, real Postgres). Two phases across an app restart to
// prove queued-record survival (D19):
//   Phase A (fresh db): D01–D18, leaves 3 offline entries pending + marker.
//   Phase B (after force-stop + relaunch): verifies pending survived, syncs,
//   then D20–D24. Every step logs NIAVERP_DTEST JSON (adb logcat) and returns
// a structured summary rendered on-screen.
import { command, newSource, type Auth } from "./api.js";
import { SqliteOutbox, type SQLiteDb } from "./sqlite-outbox.js";
import { syncNow } from "./sync-worker.js";

export interface StepResult {
  step: string;
  ok: boolean;
  detail?: string;
}

const BERTH = "2026-09-27";
const GST = { supplyClass: "taxable", intraState: true, rateRef: "EXAMPLE-9+9" } as const;

function log(step: string, ok: boolean, detail = ""): StepResult {
  const row = { step, ok, detail };
  // eslint-disable-next-line no-console
  console.log(`NIAVERP_DTEST ${JSON.stringify(row)}`);
  return row;
}

async function cmd<T>(baseUrl: string, auth: Auth, op: string, input: unknown): Promise<T> {
  return command<T>(baseUrl, auth, op, input);
}

export async function runPhaseA(
  db: SQLiteDb, baseUrl: string, owner: Auth, _viewer: Auth,
): Promise<{ steps: StepResult[]; kacha: string; saleForReversal: string }> {
  const steps: StepResult[] = [];
  const put = (s: StepResult) => { steps.push(s); return s.ok; };
  try {
    // D01 sign in (dev-trust auth resolves against memberships)
    await cmd(baseUrl, owner, "read.stock", {});
    put(log("D01", true, "owner session resolved"));
    // D02 company context
    put(log("D02", owner.companyId === "c1", `company=${owner.companyId}`));
    // D03–D06 masters
    const supp = await cmd<{ id: string }>(baseUrl, owner, "party.create", { id: newSource("party"), name: "Device Supplier", roles: ["supplier"] });
    put(log("D03", !!supp.id, supp.id));
    const cust = await cmd<{ id: string }>(baseUrl, owner, "party.create", { id: newSource("party"), name: "Device Customer", roles: ["customer"] });
    put(log("D04", !!cust.id, cust.id));
    const item = await cmd<{ id: string }>(baseUrl, owner, "item.create", { id: newSource("item"), name: "Device Rice" });
    put(log("D05", !!item.id, item.id));
    const shop = await cmd<{ id: string }>(baseUrl, owner, "location.create", { id: newSource("loc"), name: "Device Shop" });
    put(log("D06", !!shop.id, shop.id));
    // D07 purchase + D08 payment
    const pur = await cmd<{ voucherNumber: number | string; sourceId: string }>(baseUrl, owner, "purchase.post", {
      sourceId: newSource("src"), partyId: supp.id, series: "PUR", businessDate: BERTH,
      lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 200, unitPricePaise: 500 }],
      accounts: { debitCode: "PURCH", creditCode: "SUPP" }, gst: GST, supplierRef: "DEV-SUP-001",
    });
    put(log("D07", Number(pur.voucherNumber) >= 1, `#${pur.voucherNumber}`));
    await cmd(baseUrl, owner, "payment.post", {
      sourceId: newSource("src"), series: "PAY", businessDate: BERTH,
      debitCode: "SUPP", creditCode: "CASH", amount: 100000, method: "bank",
      applications: [{ invoiceSource: pur.sourceId, amount: 100000 }],
    });
    put(log("D08", true, "supplier paid in full"));
    // D09 sale + D10 payment
    const sale = await cmd<{ voucherNumber: number | string; sourceId: string }>(baseUrl, owner, "sale.post", {
      sourceId: newSource("src"), partyId: cust.id, series: "INV", businessDate: BERTH,
      lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 10, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    put(log("D09", Number(sale.voucherNumber) >= 1, `#${sale.voucherNumber}`));
    await cmd(baseUrl, owner, "payment.post", {
      sourceId: newSource("src"), series: "PAY", businessDate: BERTH,
      debitCode: "CASH", creditCode: "CUST", amount: 8000, method: "upi",
      applications: [{ invoiceSource: sale.sourceId, amount: 8000 }],
    });
    put(log("D10", true, "customer paid in full"));
    // D11 kacha + D12 convert (partial 40 of 100)
    const stockBefore = await cmd<Array<{ item: string; location: string; on_hand: string }>>(baseUrl, owner, "read.stock", {});
    const beforeQty = Number(stockBefore.find((r) => r.item === item.id && r.location === shop.id)?.on_hand ?? "0");
    const kacha = await cmd<{ sourceId: string }>(baseUrl, owner, "kacha.create", {
      sourceId: newSource("src"), partyId: cust.id, series: "CH-KACHA", businessDate: BERTH,
      lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 100, ratePaise: 800 }],
    });
    put(log("D11", !!kacha.sourceId, kacha.sourceId));
    const stockAfter = await cmd<Array<{ item: string; location: string; on_hand: string }>>(baseUrl, owner, "read.stock", {});
    const afterQty = Number(stockAfter.find((r) => r.item === item.id && r.location === shop.id)?.on_hand ?? "0");
    put(log("D11b", afterQty === beforeQty - 100, `delivery moved stock once (${beforeQty}→${afterQty})`));
    // D12 convert (40 of 100): accounting/GST only, stock unchanged
    const stockPreConv = afterQty;
    const conv = await cmd<{ voucherNumber: number | string }>(baseUrl, owner, "kacha.convert", {
      refs: [{ kachaSource: kacha.sourceId, lineId: `${kacha.sourceId}-l0`, qtyMinor: 40 }],
      series: "INV", businessDate: BERTH, unitPricePaise: 800,
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    put(log("D12", Number(conv.voucherNumber) >= 1, `#${conv.voucherNumber} (40/100)`));
    const stockPostConv = await cmd<Array<{ item: string; location: string; on_hand: string }>>(baseUrl, owner, "read.stock", {});
    const postConvQty = Number(stockPostConv.find((r) => r.item === item.id && r.location === shop.id)?.on_hand ?? "0");
    put(log("D12b", postConvQty === stockPreConv, `invoice added no movement (${stockPreConv}→${postConvQty})`));
    // D13 purchase return + D14 sales return
    await cmd(baseUrl, owner, "return.post", {
      originalSource: pur.sourceId, series: "RET", businessDate: BERTH,
      lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 5, unitPricePaise: 500 }],
      accounts: { debitCode: "SUPP", creditCode: "PURCH" }, reason: "device-short-supply", side: "purchase",
    });
    put(log("D13", true, "purchase return posted"));
    await cmd(baseUrl, owner, "return.post", {
      originalSource: sale.sourceId, series: "RET", businessDate: BERTH,
      lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 2, unitPricePaise: 800 }],
      accounts: { debitCode: "SALES", creditCode: "CUST" }, reason: "device-damage", side: "sales",
    });
    put(log("D14", true, "sales return posted"));
    // D15 reversal (fresh small sale) + correction shape (reverse + replace)
    const revSale = await cmd<{ sourceId: string }>(baseUrl, owner, "sale.post", {
      sourceId: newSource("src"), partyId: cust.id, series: "INV", businessDate: BERTH,
      lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 3, unitPricePaise: 800 }],
      accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
    });
    await cmd(baseUrl, owner, "reverse", { originalSource: revSale.sourceId, series: "REV", businessDate: BERTH, reason: "device-test" });
    const corr = await cmd<{ correctionId: string }>(baseUrl, owner, "correct", {
      originalSource: sale.sourceId, series: "INV", businessDate: BERTH, reason: "device-qty-fix",
      replacement: {
        partyId: cust.id,
        lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 8, unitPricePaise: 800 }],
        accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      },
    });
    put(log("D15", !!corr.correctionId, `reversed + corrected ${corr.correctionId}`));
    // D16–D18 offline queue (no POST — airplane-mode equivalent)
    const store = await SqliteOutbox.open(db);
    const now = new Date().toISOString();
    const offPur = newSource("src");
    const offSale = newSource("src");
    const offKacha = newSource("src");
    await store.enqueue({
      sourceId: offPur, kind: "purchase",
      payload: {
        partyId: supp.id, series: "PUR", businessDate: BERTH,
        lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 7, unitPricePaise: 500 }],
        accounts: { debitCode: "PURCH", creditCode: "SUPP" }, gst: GST, supplierRef: "DEV-SUP-OFF",
      },
      status: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now,
    });
    put(log("D16", true, `queued ${offPur}`));
    await store.enqueue({
      sourceId: offSale, kind: "sale",
      payload: {
        partyId: cust.id, series: "INV", businessDate: BERTH,
        lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 4, unitPricePaise: 800 }],
        accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      },
      status: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now,
    });
    put(log("D17", true, `queued ${offSale}`));
    await store.enqueue({
      sourceId: offKacha, kind: "kacha",
      payload: {
        partyId: cust.id, series: "CH-KACHA", businessDate: BERTH,
        lines: [{ itemId: item.id, locationId: shop.id, qtyMinor: 25, ratePaise: 800 }],
      },
      status: "pending", attempts: 0, lastError: null, createdAt: now, updatedAt: now,
    });
    put(log("D18", true, `queued ${offKacha}`));
    await db.execAsync(`CREATE TABLE IF NOT EXISTS selftest_phase (phase TEXT PRIMARY KEY, detail TEXT);
      INSERT OR REPLACE INTO selftest_phase VALUES ('phase-a-done','${offPur},${offSale},${offKacha}')`);
    // eslint-disable-next-line no-console
    console.log(`NIAVERP_SELFTEST ${JSON.stringify({ phase: "A", passed: steps.filter((s) => s.ok).length, failed: steps.filter((s) => !s.ok).map((s) => s.step) })}`);
    return { steps, kacha: kacha.sourceId, saleForReversal: sale.sourceId };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    steps.push(log("PHASE-A-ABORT", false, detail));
    // eslint-disable-next-line no-console
    console.log(`NIAVERP_SELFTEST ${JSON.stringify({ phase: "A", aborted: detail })}`);
    return { steps, kacha: "", saleForReversal: "" };
  }
}

export async function runPhaseB(db: SQLiteDb, baseUrl: string, owner: Auth, viewer: Auth): Promise<StepResult[]> {
  const steps: StepResult[] = [];
  const put = (s: StepResult) => { steps.push(s); return s.ok; };
  try {
    // D19: pending survived the restart?
    const store = await SqliteOutbox.open(db);
    const pending = await store.listPending(50);
    put(log("D19", pending.length === 3, `pending-after-restart=${pending.length}`));
    // D20: sync
    const res = await syncNow(store, baseUrl, owner);
    put(log("D20", res.acked.length === 3, `acked=${res.acked.length}`));
    const counts = await store.countByStatus();
    put(log("D23", counts.pending === 0 && counts.acked === 3, JSON.stringify(counts)));
    // D21: duplicate retry converges (re-submit first offline sale source)
    const first = pending[1];
    if (first) {
      const dup = await cmd<{ deduped?: boolean }>(baseUrl, owner, "sale.post", {
        ...(first.payload as object), sourceId: first.sourceId,
      });
      put(log("D21", dup.deduped === true, `deduped=${dup.deduped}`));
    } else {
      put(log("D21", false, "no offline sale found"));
    }
    // D22: history + audit
    const hist = await cmd<{ legs: unknown[]; moves: unknown[]; tax: unknown[]; audits: unknown[] }>(
      baseUrl, owner, "txn.get", { source: pending[1]?.sourceId ?? "missing" });
    put(log("D22", hist.audits.length > 0 && hist.legs.length === 2, `legs=${hist.legs.length} audits=${hist.audits.length}`));
    // D24: viewer write rejected on device
    try {
      await cmd(baseUrl, viewer, "sale.post", {
        sourceId: newSource("src"), partyId: "x", series: "INV", businessDate: BERTH,
        lines: [], accounts: { debitCode: "CUST", creditCode: "SALES" }, gst: GST,
      });
      put(log("D24", false, "viewer post unexpectedly succeeded"));
    } catch (e) {
      put(log("D24", /UNAUTHORIZED/.test(e instanceof Error ? e.message : ""), "viewer blocked"));
    }
    // eslint-disable-next-line no-console
    console.log(`NIAVERP_SELFTEST ${JSON.stringify({ phase: "B", passed: steps.filter((s) => s.ok).length, failed: steps.filter((s) => !s.ok).map((s) => s.step) })}`);
    return steps;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    steps.push(log("PHASE-B-ABORT", false, detail));
    // eslint-disable-next-line no-console
    console.log(`NIAVERP_SELFTEST ${JSON.stringify({ phase: "B", aborted: detail })}`);
    return steps;
  }
}

export async function selftestPhase(db: SQLiteDb): Promise<"A" | "B"> {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS selftest_phase (phase TEXT PRIMARY KEY, detail TEXT)`);
  const rows = await db.getAllAsync<{ phase: string }>(`SELECT phase FROM selftest_phase WHERE phase='phase-a-done'`);
  return rows.length > 0 ? "B" : "A";
}
