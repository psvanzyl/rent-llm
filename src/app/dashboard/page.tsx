"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface KeyRow {
  id: string;
  prefix: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  usage?: { requests: number; promptTokens: number; completionTokens: number; lastUsedAt?: string };
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<{ active: boolean; tier: string | null; until: string | null } | null>(null);

  async function load() {
    const me = await fetch("/api/auth/me");
    if (!me.ok) { router.push("/login"); return; }
    const meData = await me.json();
    setUser(meData.user);
    const kr = await fetch("/api/keys");
    const kd = await kr.json();
    setKeys(kd.keys || []);
    try {
      const br = await fetch("/api/billing");
      if (br.ok) setBilling(await br.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createKey() {
    setKeyError(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName || "default" }),
    });
    const data = await res.json();
    if (res.ok) {
      setCreatedKey(data.key);
      setNewKeyName("");
      load();
    } else {
      setKeyError(data?.message || data?.error || "Could not create key.");
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this key?")) return;
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    load();
  }

  async function subscribe(plan: string) {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        alert(data?.message || data?.error || "Checkout failed");
      }
    } catch {
      alert("Network error");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-20 text-gray-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white">Sign out</button>
      </div>

      {createdKey && (
        <div className="mt-6 rounded-lg border border-green-700 bg-green-900/30 p-4">
          <p className="text-sm font-medium text-green-300">New API key created. Copy it now — it won&apos;t be shown again.</p>
          <code className="mt-2 block break-all rounded bg-black p-2 text-sm text-green-200">{createdKey}</code>
          <button onClick={() => setCreatedKey(null)} className="mt-2 text-xs text-gray-400 hover:text-white">Dismiss</button>
        </div>
      )}

      <section className="mt-8 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <h2 className="text-lg font-semibold">Subscription</h2>
        {billing ? (
          <div className="mt-2 text-sm text-gray-300">
            <p>Status: {billing.active ? "Active" : "Inactive"}</p>
            <p>Tier: {billing.tier || "none"}</p>
            {billing.until && <p>Access until: {new Date(billing.until).toLocaleDateString()}</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">Loading billing…</p>
        )}
        {billing?.active && (
          <button
            onClick={() => subscribe(billing.tier || "basic")}
            className="mt-4 rounded-md border border-amber-500 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10"
          >
            Extend {billing.tier || "basic"} — €{billing.tier === "pro" ? 50 : 20} for 31 more days
          </button>
        )}
        {billing && !billing.active && (
          <>
            <div className="mt-4 flex gap-2">
              <button onClick={() => subscribe("basic")} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400">
                Subscribe Basic (€20/mo)
              </button>
              <button onClick={() => subscribe("pro")} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500">
                Subscribe Pro (€50/mo)
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Payment via Mollie. You will be redirected to the hosted checkout.</p>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Create API key</h2>
        {billing?.active ? (
          <>
            <div className="mt-3 flex gap-2">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (optional)"
                className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
              />
              <button onClick={createKey} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400">
                Create
              </button>
            </div>
            {keyError && <p className="mt-2 text-sm text-red-400">{keyError}</p>}
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            An active subscription is required to create API keys. Pick a plan above to continue.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your API keys</h2>
        {keys.length === 0 && <p className="mt-3 text-sm text-gray-400">No keys yet.</p>}
        <div className="mt-3 space-y-3">
          {keys.map((k) => (
            <div key={k.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm">{k.prefix}…</p>
                  <p className="text-xs text-gray-500">{k.name} · created {new Date(k.createdAt).toLocaleDateString()}</p>
                </div>
                {!k.revokedAt && (
                  <button onClick={() => revokeKey(k.id)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                )}
                {k.revokedAt && <span className="text-xs text-gray-500">revoked</span>}
              </div>
              {k.usage && (
                <p className="mt-2 text-xs text-gray-400">
                  {k.usage.requests} requests · {k.usage.promptTokens} prompt tokens · {k.usage.completionTokens} completion tokens
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {billing?.active && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Usage</h2>
          <p className="mt-2 text-sm text-gray-400">
            Base URL: <code className="text-amber-300">https://broomy.laserraptor.eu/api/v1</code>
          </p>
          <p className="text-sm text-gray-400">
            Model: <code className="text-amber-300">qwen3.8-flash-next-ud-q4_k_xl</code> (also: qwen3.8-flash, qwen3.8-flash-next-iq3_s, sensei-qwen3.8-flash)
          </p>
        </section>
      )}
    </div>
  );
}
