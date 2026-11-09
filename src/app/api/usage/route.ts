/**
 * GET /api/usage?days=30
 *
 * A user's OWN API-call history: per day and per key, with token counts.
 * Requires a normal login session. Returns only events whose key belongs to
 * the caller — never another user's data. The admin-wide view lives at
 * /api/admin/usage.
 */
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readUsageLog, eventRequests, groupSessions } from "@/lib/usage";
import { listApiKeys } from "@/lib/apikeys";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  const [events, keys] = await Promise.all([readUsageLog(), listApiKeys(user.id)]);
  const myKeyIds = new Set(keys.map((k) => k.id));
  const mine = events.filter((ev) => ev.userId === user.id && myKeyIds.has(ev.keyId));

  const byDay = new Map<string, { requests: number; promptTokens: number; completionTokens: number }>();
  const byKey = new Map<string, { requests: number; promptTokens: number; completionTokens: number; lastUsedAt: string | null }>();
  for (const k of keys) byKey.set(k.id, { requests: 0, promptTokens: 0, completionTokens: 0, lastUsedAt: null });
  for (const ev of mine) {
    const d = ev.ts.slice(0, 10);
    const day = byDay.get(d) || { requests: 0, promptTokens: 0, completionTokens: 0 };
    day.requests += eventRequests(ev);
    day.promptTokens += ev.pt;
    day.completionTokens += ev.ct;
    byDay.set(d, day);
    const kk = byKey.get(ev.keyId)!;
    kk.requests += eventRequests(ev);
    kk.promptTokens += ev.pt;
    kk.completionTokens += ev.ct;
    if (!kk.lastUsedAt || ev.ts > kk.lastUsedAt) kk.lastUsedAt = ev.ts;
  }

  const totals = mine.reduce(
    (acc, ev) => ({ requests: acc.requests + eventRequests(ev), promptTokens: acc.promptTokens + ev.pt, completionTokens: acc.completionTokens + ev.ct }),
    { requests: 0, promptTokens: 0, completionTokens: 0 },
  );

  const calls = [...mine]
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 100)
    .map((ev) => ({
      ts: ev.ts,
      keyName: keys.find((k) => k.id === ev.keyId)?.name || ev.keyName || ev.keyId,
      model: ev.model || null,
      pt: ev.pt,
      ct: ev.ct,
      ca: ev.ca ?? 0,
      ms: ev.ms ?? null,
      stream: ev.stream ?? false,
      requests: eventRequests(ev),
      backfilled: Boolean(ev.backfilled),
    }));

  return NextResponse.json({
    days,
    logSince: events.length ? events[0].ts : null,
    totals,
    sessions: groupSessions(mine),
    calls,
    perDay: [...byDay.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    byKey: [...byKey.entries()].map(([keyId, v]) => {
      const k = keys.find((x) => x.id === keyId)!;
      return { keyId, keyName: k.name, revoked: Boolean(k.revokedAt), ...v };
    }),
  });
};

export const GET = jsonRoute("usage", { GET: handler_GET });
