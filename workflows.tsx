import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { command, newSource, type Auth } from "../lib/api";

// Sales screen: captures commercial intent (party/lines) and posts through
// sale.post. Totals/tax/stock are server-computed; the screen shows only
// the returned voucher number and errors.
export function SalesScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [partyId, setPartyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [locId, setLocId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("800");
  const [log, setLog] = useState("");
  const post = async () => {
    try {
      const out = await command<{ voucherNumber: number | string }>(baseUrl, auth, "sale.post", {
        sourceId: newSource("src"), partyId, series: "INV", businessDate: new Date().toISOString().slice(0, 10),
        lines: [{ itemId, locationId: locId, qtyMinor: Number(qty), unitPricePaise: Number(price) }],
        accounts: { debitCode: "CUST", creditCode: "SALES" },
        gst: { supplyClass: "taxable", intraState: true, rateRef: "EXAMPLE-9+9" },
      });
      setLog(`posted invoice #${out.voucherNumber}`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Sales (offline queues via Sync screen when unreachable)</Text>
      <TextInput value={partyId} onChangeText={setPartyId} placeholder="customer party id" />
      <TextInput value={itemId} onChangeText={setItemId} placeholder="item id" />
      <TextInput value={locId} onChangeText={setLocId} placeholder="location id" />
      <TextInput value={qty} onChangeText={setQty} placeholder="qty (minor units)" />
      <TextInput value={price} onChangeText={setPrice} placeholder="unit price (paise)" />
      <Button title="Post sale" onPress={() => void post()} />
      <Text>{log}</Text>
    </View>
  );
}

// Purchases screen: supplierRef is captured as an attribute; the NiavERP
// source/voucher identity stays canonical (duplicate refs fail closed).
export function PurchasesScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [partyId, setPartyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [locId, setLocId] = useState("");
  const [qty, setQty] = useState("10");
  const [price, setPrice] = useState("500");
  const [supplierRef, setSupplierRef] = useState("");
  const [log, setLog] = useState("");
  const post = async () => {
    try {
      const out = await command<{ voucherNumber: number | string }>(baseUrl, auth, "purchase.post", {
        sourceId: newSource("src"), partyId, series: "PUR", businessDate: new Date().toISOString().slice(0, 10),
        lines: [{ itemId, locationId: locId, qtyMinor: Number(qty), unitPricePaise: Number(price) }],
        accounts: { debitCode: "PURCH", creditCode: "SUPP" },
        gst: { supplyClass: "taxable", intraState: true, rateRef: "EXAMPLE-9+9" },
        supplierRef,
      });
      setLog(`posted purchase #${out.voucherNumber}`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Purchases</Text>
      <TextInput value={partyId} onChangeText={setPartyId} placeholder="supplier party id" />
      <TextInput value={itemId} onChangeText={setItemId} placeholder="item id" />
      <TextInput value={locId} onChangeText={setLocId} placeholder="location id" />
      <TextInput value={qty} onChangeText={setQty} placeholder="qty (minor units)" />
      <TextInput value={price} onChangeText={setPrice} placeholder="unit price (paise)" />
      <TextInput value={supplierRef} onChangeText={setSupplierRef} placeholder="supplier bill no" />
      <Button title="Post purchase" onPress={() => void post()} />
      <Text>{log}</Text>
    </View>
  );
}

// Kacha/Pakka screen: numbered challan create + conversion with remaining
// shown from read.kacha (derived server-side, never a local counter).
export function KachaScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [partyId, setPartyId] = useState("");
  const [itemId, setItemId] = useState("");
  const [locId, setLocId] = useState("");
  const [qty, setQty] = useState("100");
  const [rate, setRate] = useState("800");
  const [kacha, setKacha] = useState("");
  const [convQty, setConvQty] = useState("40");
  const [log, setLog] = useState("");
  const create = async () => {
    try {
      const out = await command<{ sourceId: string }>(baseUrl, auth, "kacha.create", {
        sourceId: newSource("src"), partyId, series: "CH-KACHA", businessDate: new Date().toISOString().slice(0, 10),
        lines: [{ itemId, locationId: locId, qtyMinor: Number(qty), ratePaise: Number(rate) }],
      });
      setKacha(out.sourceId);
      setLog(`kacha ${out.sourceId} (delivery moved stock; no accounting)`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  const convert = async () => {
    try {
      const out = await command<{ voucherNumber: number | string }>(baseUrl, auth, "kacha.convert", {
        refs: [{ kachaSource: kacha, lineId: `${kacha}-l0`, qtyMinor: Number(convQty) }],
        series: "INV", businessDate: new Date().toISOString().slice(0, 10), unitPricePaise: Number(rate),
        accounts: { debitCode: "CUST", creditCode: "SALES" },
        gst: { supplyClass: "taxable", intraState: true, rateRef: "EXAMPLE-9+9" },
      });
      setLog(`converted → invoice #${out.voucherNumber}`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Kacha → Pakka (rate edits denied; snapshot preserved)</Text>
      <TextInput value={partyId} onChangeText={setPartyId} placeholder="customer party id" />
      <TextInput value={itemId} onChangeText={setItemId} placeholder="item id" />
      <TextInput value={locId} onChangeText={setLocId} placeholder="delivery location id" />
      <TextInput value={qty} onChangeText={setQty} placeholder="qty" />
      <TextInput value={rate} onChangeText={setRate} placeholder="rate (paise)" />
      <Button title="Create kacha" onPress={() => void create()} />
      <TextInput value={convQty} onChangeText={setConvQty} placeholder="convert qty" />
      <Button title="Convert to pakka" onPress={() => void convert()} />
      <Text>{log}</Text>
    </View>
  );
}

// Payments screen: records money movement + optional applications.
// Zero applications = advance (never auto-applied — server rule).
export function PaymentsScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [debit, setDebit] = useState("CASH");
  const [credit, setCredit] = useState("CUST");
  const [amount, setAmount] = useState("1000");
  const [invoice, setInvoice] = useState("");
  const [log, setLog] = useState("");
  const post = async () => {
    try {
      const out = await command<{ voucherNumber: number | string }>(baseUrl, auth, "payment.post", {
        sourceId: newSource("src"), series: "PAY", businessDate: new Date().toISOString().slice(0, 10),
        debitCode: debit, creditCode: credit, amount: Number(amount), method: "cash",
        applications: invoice ? [{ invoiceSource: invoice, amount: Number(amount) }] : [],
      });
      setLog(`payment #${out.voucherNumber}${invoice ? "" : " (advance)"}`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Payments</Text>
      <TextInput value={debit} onChangeText={setDebit} placeholder="debit code" />
      <TextInput value={credit} onChangeText={setCredit} placeholder="credit code" />
      <TextInput value={amount} onChangeText={setAmount} placeholder="amount (paise)" />
      <TextInput value={invoice} onChangeText={setInvoice} placeholder="invoice source (blank = advance)" />
      <Button title="Post payment" onPress={() => void post()} />
      <Text>{log}</Text>
    </View>
  );
}
