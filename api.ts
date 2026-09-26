// API client: every write goes through POST /command (server authoritative).
// Screens render data and capture intents; zero business math lives here.
// NOTE: device/user session is captured at sign-in; dev trust matches the
// server API (Supabase JWT plugs in at packages/api when the project exists).
export interface Auth {
  userId: string;
  companyId: string;
  deviceId: string;
}

export async function command<T>(baseUrl: string, auth: Auth, op: string, input: unknown): Promise<T> {
  const r = await fetch(`${baseUrl}/command`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth, op, input }),
  });
  const body = (await r.json()) as { ok: boolean; out?: T; error?: string };
  if (!body.ok) throw new Error(body.error ?? "UNKNOWN");
  return body.out as T;
}

export function newSource(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}
