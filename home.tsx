import { useState } from "react";
import { Button, FlatList, Text, TextInput, View } from "react-native";
import { command, type Auth } from "../lib/api";
import { syncNow } from "../lib/sync-worker";
import { SqliteOutbox, type SQLiteDb } from "../lib/sqlite-outbox";

// History screen: transaction lookup + audit trail (read-only, server truth).
export function HistoryScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [source, setSource] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const lookup = async () => {
    try {
      const t = await command<{ head: unknown; legs: unknown[]; moves: unknown[]; tax: unknown[]; audits: unknown[] }>(
        baseUrl, auth, "txn.get", { source });
      setLog([
        `head ${JSON.stringify(t.head)}`,
        `legs ${t.legs.length} moves ${t.moves.length} tax ${t.tax.length} audits ${t.audits.length}`,
        ...t.audits.map((a) => `audit ${JSON.stringify(a)}`),
      ]);
    } catch (e) {
      setLog([`ERR ${e instanceof Error ? e.message : e}`]);
    }
  };
  return (
    <View>
      <Text>Transactions / history</Text>
      <TextInput value={source} onChangeText={setSource} placeholder="source id" />
      <Button title="Lookup" onPress={() => void lookup()} />
      <FlatList data={log} keyExtractor={(x, i) => `${i}`} renderItem={({ item }) => <Text>{item}</Text>} />
    </View>
  );
}

// Dashboard: read-only folds (registers, stock, payments, tax). No math here.
export function DashboardScreen({ baseUrl, auth }: { baseUrl: string; auth: Auth }) {
  const [log, setLog] = useState("");
  const refresh = async () => {
    try {
      const sales = await command<unknown[]>(baseUrl, auth, "read.sales", {});
      const stock = await command<unknown[]>(baseUrl, auth, "read.stock", {});
      const pays = await command<unknown[]>(baseUrl, auth, "read.payments", {});
      setLog(`sales ${sales.length} stock-lines ${stock.length} payments ${pays.length}`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Dashboard</Text>
      <Button title="Refresh" onPress={() => void refresh()} />
      <Text>{log}</Text>
    </View>
  );
}

// Company screen: context display (membership-resolved server-side).
export function CompanyScreen({ auth }: { auth: Auth }) {
  return (
    <View>
      <Text>Company: {auth.companyId}</Text>
      <Text>User: {auth.userId}</Text>
      <Text>Device: {auth.deviceId}</Text>
    </View>
  );
}

// Sync screen: outbox counts + manual flush. Status only — the queue
// semantics are tested in @niaverp/sync; expo-sqlite binding below.
export function SyncScreen({ baseUrl, auth, db }: { baseUrl: string; auth: Auth; db: SQLiteDb }) {
  const [log, setLog] = useState("not synced yet");
  const run = async () => {
    try {
      const store = await SqliteOutbox.open(db);
      const res = await syncNow(store, baseUrl, auth);
      setLog(`synced kinds: ${JSON.stringify(res.kinds)}`);
    } catch (e) {
      setLog(`ERR ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <View>
      <Text>Sync status</Text>
      <Button title="Sync now" onPress={() => void run()} />
      <Text>{log}</Text>
    </View>
  );
}
