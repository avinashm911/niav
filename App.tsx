import { useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SQLite from "expo-sqlite";
import { SignInScreen, useSession } from "./app/signin";
import { CompanyScreen, DashboardScreen, HistoryScreen } from "./app/home";
import { ItemsScreen, LocationsScreen, PartiesScreen } from "./app/masters";
import { KachaScreen, PaymentsScreen, PurchasesScreen, SalesScreen } from "./app/workflows";
import { runPhaseA, runPhaseB, selftestPhase, type StepResult } from "./lib/selftest";
import type { Auth } from "./lib/api";

// Set EXPO_PUBLIC_SELFTEST=phase-a|phase-b when starting Metro to auto-run
// the native D01–D24 self-test on launch (results via logcat + on-screen).
const SELFTEST_PHASE = process.env.EXPO_PUBLIC_SELFTEST;
const DEVICE_BASE_URL = "http://10.0.2.2:3000";
const DEVICE_OWNER: Auth = { userId: "u-owner", companyId: "c1", deviceId: "emulator-1" };
const DEVICE_VIEWER: Auth = { userId: "u-viewer", companyId: "c1", deviceId: "emulator-1" };

function SelfTestRunner() {
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await SQLite.openDatabaseAsync("niaverp-device.db");
        const phase = SELFTEST_PHASE === "phase-b" ? "B" : SELFTEST_PHASE === "phase-a" ? "A" : await selftestPhase(db);
        const out =
          phase === "B"
            ? await runPhaseB(db, DEVICE_BASE_URL, DEVICE_OWNER, DEVICE_VIEWER)
            : await runPhaseA(db, DEVICE_BASE_URL, DEVICE_OWNER, DEVICE_VIEWER);
        if (!cancelled) {
          setSteps(out);
          setDone(true);
        }
      } catch (e) {
        if (!cancelled) {
          setSteps([{ step: "RUNNER-ABORT", ok: false, detail: e instanceof Error ? e.message : String(e) }]);
          setDone(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <ScrollView>
      <Text>SelfTest {done ? "DONE" : "RUNNING"} — {steps.filter((s) => s.ok).length}/{steps.length} passed</Text>
      {steps.map((s, i) => (
        <Text key={i}>
          {s.ok ? "PASS" : "FAIL"} {s.step} {s.detail ?? ""}
        </Text>
      ))}
    </ScrollView>
  );
}

// Minimal nav: state-switched sections (expo-router deferred).
// No business logic here — screens call lib/api only.
const SECTIONS = [
  "Company", "Dashboard", "Parties", "Items", "Locations",
  "Sales", "Kacha", "Purchases", "Payments", "History", "Sync", "SelfTest",
] as const;

export default function App() {
  const { baseUrl, auth, setAuth } = useSession();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>(SELFTEST_PHASE ? "SelfTest" : "Dashboard");
  if (SELFTEST_PHASE) {
    return (
      <View>
        <StatusBar />
        <SelfTestRunner />
      </View>
    );
  }
  if (!auth) return <SignInScreen baseUrl={baseUrl} onAuth={setAuth} />;
  return (
    <View>
      <StatusBar />
      <Text>NiavERP — {section}</Text>
      {SECTIONS.map((s) => (
        <Button key={s} title={s} onPress={() => setSection(s)} />
      ))}
      {section === "Company" && <CompanyScreen auth={auth} />}
      {section === "Dashboard" && <DashboardScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Parties" && <PartiesScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Items" && <ItemsScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Locations" && <LocationsScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Sales" && <SalesScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Kacha" && <KachaScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Purchases" && <PurchasesScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Payments" && <PaymentsScreen baseUrl={baseUrl} auth={auth} />}
      {section === "History" && <HistoryScreen baseUrl={baseUrl} auth={auth} />}
      {section === "Sync" && (
        <Text>Sync binds to expo-sqlite on device — see lib/sqlite-outbox.ts + lib/sync-worker.ts.</Text>
      )}
      {section === "SelfTest" && <SelfTestRunner />}
    </View>
  );
}
