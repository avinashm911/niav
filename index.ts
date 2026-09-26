// Minimal HTTP API: JSON POST /command -> server commands. Zero dependencies
// (node:http only). Auth: caller passes userId+companyId+deviceId (dev trust;
// Supabase JWT verification plugs in here when the project exists).
// Every write path delegates to @niaverp/server (domain authoritative).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Pool } from "pg";
import {
  authenticate, convertKacha, correctSource, createItem, createKacha, createLocation,
  createParty, getAuditTrail, getTransaction, kachaRemaining, postPayment, postPurchase,
  postReturn, postSale, reverseSource, submitSync,
} from "../../server/src/index.js";
import {
  accountBalance, kachaTrace, paymentSummary, purchaseRegister, salesRegister,
  stockBalances, taxSummary,
} from "../../server/src/reads.js";

export function createApi(pool: Pool) {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST" || !req.url?.startsWith("/command")) {
      res.writeHead(req.url === "/health" ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(req.url === "/health" ? { ok: true } : { error: "NOT_FOUND" }));
      return;
    }
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      (async () => {
        try {
          const msg = JSON.parse(body) as { auth: { userId: string; companyId: string; deviceId: string }; op: string; input: Record<string, unknown> };
          const s = await authenticate(pool, msg.auth.userId, msg.auth.companyId, msg.auth.deviceId);
          const input = msg.input;
          let out: unknown;
          switch (msg.op) {
            case "party.create": out = await createParty(pool, s, input as never); break;
            case "item.create": out = await createItem(pool, s, input as never); break;
            case "location.create": out = await createLocation(pool, s, input as never); break;
            case "sale.post": out = await postSale(pool, s, input as never); break;
            case "purchase.post": out = await postPurchase(pool, s, input as never); break;
            case "payment.post": out = await postPayment(pool, s, input as never); break;
            case "kacha.create": out = await createKacha(pool, s, input as never); break;
            case "kacha.convert": out = await convertKacha(pool, s, input as never); break;
            case "kacha.remaining": out = { remaining: await kachaRemaining(pool, s, (input as { kacha: string; line: string }).kacha, (input as { kacha: string; line: string }).line) }; break;
            case "return.post": out = await postReturn(pool, s, input as never); break;
            case "reverse": out = await reverseSource(pool, s, input as never); break;
            case "correct": out = await correctSource(pool, s, input as never); break;
            case "txn.get": out = await getTransaction(pool, s, (input as { source: string }).source); break;
            case "audit.trail": out = await getAuditTrail(pool, s, (input as { source: string }).source); break;
            case "sync.submit": out = await submitSync(pool, s, input as never); break;
            case "read.sales": out = await salesRegister(pool, s); break;
            case "read.purchases": out = await purchaseRegister(pool, s); break;
            case "read.stock": out = await stockBalances(pool, s); break;
            case "read.balance": out = { balance: await accountBalance(pool, s, (input as { account: string }).account) }; break;
            case "read.payments": out = await paymentSummary(pool, s); break;
            case "read.tax": out = await taxSummary(pool, s); break;
            case "read.kacha": out = await kachaTrace(pool, s, (input as { kacha: string }).kacha); break;
            default: throw new Error(`INVALID_SOURCE: unknown op ${msg.op}`);
          }
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true, out }));
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const status = /UNAUTHORIZED|INVALID_|CONFLICT|STOCK_|TAX_|ACCOUNTING_|INVENTORY_|GST_|PAYMENT_|PERIOD_|POSTED_|DUPLICATE/.test(message) ? 422 : 500;
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      })();
    });
  });
}
