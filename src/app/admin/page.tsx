"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DayRow {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  users: Record<string, { requests: number; tokens: number }>;
}

interface UserRow {
  id: string;
  email: string;
  name?: string;
  tier: string | null;
  subscriptionUntil: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  keys: { id: string; name: string; createdAt: string; revokedAt: string | null }[];
  allTime: { requests: number; promptTokens: number; completionTokens: number; lastUsedAt: string | null };
  window: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    firstAt: string | null;
    lastAt: string | null;
    activeDays: { date: string; requests: number; pt: number; ct: number }[];
    byKey: { keyId: string; keyName: string; requests: number; pt: number; ct: number; firstAt: string; lastAt: string }[];
  };
}

interface Report {
  generatedAt: string;
  days: number;
  logSince: string | null;
  totals: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    activeUsers: number;
    totalUsers: number;
    payingUsers: number;
  };
  perDay: DayRow[];
  users: UserRow[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function dt(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

/** Value with a proportional bar behind it — the house filter-row style. */
function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = value > 0 && max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="relative w-full min-w-24 rounded bg-white/5">
      <div className="absolute inset-y-0 left-0 rounded bg-amber-500/25" style={{ width: `${pct}%` }} />
      <div className="relative px-2 py-1 text-right text-sm text-amber-200">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-amber-300">{value}</div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/usage?days=${days}`)
      .then(async (res) => {
        if (res.status === 401) { router.push("/login"); return; }
        if (res.status === 403) { setError("This account is not an administrator."); setReport(null); return; }
        const data = await res.json();
        if (!cancelled) { setReport(data); setError(null); }
      })
      .catch(() => { if (!cancelled) setError("Could not load usage data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, router]);

  if (loading && !report) return <div className="mx-auto max-w-5xl px-4 py-20 text-gray-400">Loading…</div>;

  const maxDayTokens = report ? Math.max(1, ...report.perDay.map((d) => d.promptTokens + d.completionTokens)) : 1;
  const maxUserTokens = report ? Math.max(1, ...report.users.map((u) => u.window.promptTokens + u.window.completionTokens)) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usage — administrator</h1>
          <p className="text-sm text-gray-400">
            Who uses the server, when, and how many tokens.
            {report?.logSince ? ` Per-day history starts ${report.logSince.slice(0, 10)}.` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded px-3 py-1 text-sm ${days === d ? "bg-amber-500 text-black" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-6 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}

      {report && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Users (all)" value={String(report.totals.totalUsers)} />
            <Stat label="Paying now" value={String(report.totals.payingUsers)} />
            <Stat label={`Active in ${report.days}d`} value={String(report.totals.activeUsers)} />
            <Stat label={`Requests in ${report.days}d`} value={fmt(report.totals.requests)} />
            <Stat
              label={`Tokens in ${report.days}d`}
              value={fmt(report.totals.promptTokens + report.totals.completionTokens)}
            />
          </div>

          <h2 className="mt-10 text-lg font-semibold">Users</h2>
          <p className="text-sm text-gray-400">Tokens per user in the selected window. All-time totals include history before the log existed.</p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Reqs</th>
                  <th className="px-3 py-2 w-40 text-right">Prompt</th>
                  <th className="px-3 py-2 w-40 text-right">Completion</th>
                  <th className="px-3 py-2">First used</th>
                  <th className="px-3 py-2">Last used</th>
                  <th className="px-3 py-2">All-time tokens</th>
                </tr>
              </thead>
              <tbody>
                {report.users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{u.name || u.email}</div>
                      {u.name && <div className="text-xs text-gray-400">{u.email}</div>}
                      <div className="text-xs text-gray-500">
                        keys: {u.keys.map((k) => k.name + (k.revokedAt ? " (revoked)" : "")).join(", ") || "none"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${u.tier === "pro" ? "bg-purple-500/20 text-purple-300" : u.tier ? "bg-sky-500/20 text-sky-300" : "bg-white/10 text-gray-400"}`}>
                        {u.tier || "free"}
                      </span>
                      {u.subscriptionUntil && (
                        <div className="mt-1 whitespace-nowrap text-xs text-gray-500">until {u.subscriptionUntil.slice(0, 10)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-200">{fmt(u.window.requests)}</td>
                    <td className="px-3 py-2"><Bar value={u.window.promptTokens} max={maxUserTokens} label={fmt(u.window.promptTokens)} /></td>
                    <td className="px-3 py-2"><Bar value={u.window.completionTokens} max={maxUserTokens} label={fmt(u.window.completionTokens)} /></td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-400">{dt(u.window.firstAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-400">{dt(u.window.lastAt || u.allTime.lastUsedAt)}</td>
                    <td className="px-3 py-2 text-gray-300">{fmt(u.allTime.promptTokens + u.allTime.completionTokens)}</td>
                  </tr>
                ))}
                {report.users.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No usage recorded in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-lg font-semibold">Days</h2>
          <p className="text-sm text-gray-400">Platform totals per day, active users included.</p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Active users</th>
                  <th className="px-3 py-2">Requests</th>
                  <th className="px-3 py-2 w-56 text-right">Tokens</th>
                  <th className="px-3 py-2">Per user (tokens)</th>
                </tr>
              </thead>
              <tbody>
                {[...report.perDay].reverse().map((d) => (
                  <tr key={d.date} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white">{d.date}</td>
                    <td className="px-3 py-2 text-gray-200">{Object.keys(d.users).length}</td>
                    <td className="px-3 py-2 text-gray-200">{fmt(d.requests)}</td>
                    <td className="px-3 py-2">
                      <Bar value={d.promptTokens + d.completionTokens} max={maxDayTokens} label={fmt(d.promptTokens + d.completionTokens)} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">
                      {Object.entries(d.users)
                        .map(([uid, v]) => {
                          const u = report.users.find((x) => x.id === uid);
                          return `${u ? u.name || u.email : uid.slice(0, 8)}: ${fmt(v.tokens)}`;
                        })
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
                {report.perDay.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No activity in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-lg font-semibold">Keys in window</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Key</th>
                  <th className="px-3 py-2">Reqs</th>
                  <th className="px-3 py-2">Prompt</th>
                  <th className="px-3 py-2">Completion</th>
                  <th className="px-3 py-2">First</th>
                  <th className="px-3 py-2">Last</th>
                </tr>
              </thead>
              <tbody>
                {report.users.flatMap((u) =>
                  u.window.byKey.map((k) => (
                    <tr key={u.id + k.keyId} className="border-t border-white/5">
                      <td className="px-3 py-2 text-gray-200">{u.name || u.email}</td>
                      <td className="px-3 py-2 text-gray-300">{k.keyName}</td>
                      <td className="px-3 py-2 text-gray-200">{fmt(k.requests)}</td>
                      <td className="px-3 py-2 text-gray-200">{fmt(k.pt)}</td>
                      <td className="px-3 py-2 text-gray-200">{fmt(k.ct)}</td>
                      <td className="px-3 py-2 text-gray-400">{dt(k.firstAt)}</td>
                      <td className="px-3 py-2 text-gray-400">{dt(k.lastAt)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-gray-500">Generated {dt(report.generatedAt)} UTC. Times are UTC.</p>
        </>
      )}
    </div>
  );
}
