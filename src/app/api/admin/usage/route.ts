/**
 * GET /api/admin/usage?days=30
 *
 * Operator view of platform usage. Requires an admin session cookie
 * (see src/lib/admin.ts). Answers: who uses the service, when, and how many
 * tokens. Two data sources:
 *
 *   - usage.json        all-time per-key totals (existed before the event log)
 *   - usage-log.jsonl   one line per request since the log shipped; drives the
 *                       per-day / per-user / per-key history in `window`
 */
import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { readAccounts } from "@/lib/accounts";
import { listAllApiKeys } from "@/lib/apikeys";
import { readUsageLog, getUsageForKeys, eventRequests, groupSessions } from "@/lib/usage";

export const dynamic = "force-dynamic";

function dayOf(ts: string): string {
  return ts.slice(0, 10);
}

interface DayAgg {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  users: Record<string, { requests: number; tokens: number }>;
}

export async function GET(req: Request) {
  const admin = await checkAdmin(req);
  if (admin.kind === "unauthenticated") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (admin.kind === "forbidden") {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  const [accounts, keys, events] = await Promise.all([
    readAccounts(),
    listAllApiKeys(),
    readUsageLog(),
  ]);
  const keysById: Record<string, { name: string; userId: string }> = {};
  for (const k of keys) keysById[k.id] = { name: k.name, userId: k.userId };

  const inWindow = events.filter((ev) => Date.parse(ev.ts) >= cutoff);

  // Per-day aggregation (platform-wide + per user within the day).
  const byDay = new Map<string, DayAgg>();
  for (const ev of inWindow) {
    const d = dayOf(ev.ts);
    let day = byDay.get(d);
    if (!day) {
      day = { date: d, requests: 0, promptTokens: 0, completionTokens: 0, users: {} };
      byDay.set(d, day);
    }
    day.requests += eventRequests(ev);
    day.promptTokens += ev.pt;
    day.completionTokens += ev.ct;
    const u = (day.users[ev.userId] ||= { requests: 0, tokens: 0 });
    u.requests += eventRequests(ev);
    u.tokens += ev.pt + ev.ct;
  }
  const perDay = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  // Per-user view: account info + all-time totals + window history.
  const users = Object.values(accounts.users).map((u) => {
    const userKeys = keys.filter((k) => k.userId === u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      tier: u.subscriptionTier || null,
      subscriptionUntil: u.subscriptionUntil || null,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || null,
      keys: userKeys.map((k) => ({
        id: k.id,
        name: k.name,
        createdAt: k.createdAt,
        revokedAt: k.revokedAt || null,
      })),
    };
  });

  const allKeyIds = keys.map((k) => k.id);
  const allTime = await getUsageForKeys(allKeyIds);

  const userViews = users.map((u) => {
    const evs = inWindow.filter((ev) => ev.userId === u.id);
    const byDayU = new Map<string, { requests: number; pt: number; ct: number }>();
    const byKey = new Map<string, { requests: number; pt: number; ct: number; firstAt: string; lastAt: string }>();
    let firstAt: string | null = null;
    let lastAt: string | null = null;
    for (const ev of evs) {
      const d = dayOf(ev.ts);
      const day = byDayU.get(d) || { requests: 0, pt: 0, ct: 0 };
      day.requests += eventRequests(ev);
      day.pt += ev.pt;
      day.ct += ev.ct;
      byDayU.set(d, day);
      const kid = ev.keyId;
      const kk = byKey.get(kid) || { requests: 0, pt: 0, ct: 0, firstAt: ev.ts, lastAt: ev.ts };
      kk.requests += eventRequests(ev);
      kk.pt += ev.pt;
      kk.ct += ev.ct;
      if (ev.ts < kk.firstAt) kk.firstAt = ev.ts;
      if (ev.ts > kk.lastAt) kk.lastAt = ev.ts;
      byKey.set(kid, kk);
      if (!firstAt || ev.ts < firstAt) firstAt = ev.ts;
      if (!lastAt || ev.ts > lastAt) lastAt = ev.ts;
    }
    const windowTotals = evs.reduce(
      (acc, ev) => ({
        requests: acc.requests + eventRequests(ev),
        promptTokens: acc.promptTokens + ev.pt,
        completionTokens: acc.completionTokens + ev.ct,
      }),
      { requests: 0, promptTokens: 0, completionTokens: 0 },
    );
    // All-time totals come from usage.json (per key) — covers history before the log existed.
    let allPt = 0;
    let allCt = 0;
    let allReqs = 0;
    let allLastUsed: string | null = null;
    for (const k of u.keys) {
      const rec = allTime[k.id];
      if (!rec) continue;
      allPt += rec.promptTokens;
      allCt += rec.completionTokens;
      allReqs += rec.requests;
      if (rec.lastUsedAt && (!allLastUsed || rec.lastUsedAt > allLastUsed)) allLastUsed = rec.lastUsedAt;
    }
    return {
      ...u,
      allTime: {
        requests: allReqs,
        promptTokens: allPt,
        completionTokens: allCt,
        lastUsedAt: allLastUsed,
      },
      window: {
        ...windowTotals,
        firstAt,
        lastAt,
        activeDays: [...byDayU.entries()]
          .map(([date, v]) => ({ date, ...v }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        byKey: [...byKey.entries()].map(([keyId, v]) => ({
          keyId,
          keyName: keysById[keyId]?.name || keyId,
          ...v,
        })),
      },
    };
  });

  const totals = perDay.reduce(
    (acc, d) => ({
      requests: acc.requests + d.requests,
      promptTokens: acc.promptTokens + d.promptTokens,
      completionTokens: acc.completionTokens + d.completionTokens,
    }),
    { requests: 0, promptTokens: 0, completionTokens: 0 },
  );
  const activeUserIds = new Set(inWindow.map((ev) => ev.userId));

  // Activity sessions (per key, 30-min gap) and the raw request log —
  // newest first, capped so the page payload stays bounded.
  const sessions = groupSessions(inWindow).map((s) => ({
    ...s,
    userEmail: accounts.users[s.userId]?.email || s.userId,
  }));
  const calls = [...inWindow]
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 200)
    .map((ev) => ({
      ts: ev.ts,
      userId: ev.userId,
      userEmail: accounts.users[ev.userId]?.email || ev.userId,
      keyName: keysById[ev.keyId]?.name || ev.keyName || ev.keyId,
      model: ev.model || null,
      pt: ev.pt,
      ct: ev.ct,
      ca: ev.ca ?? 0,
      ms: ev.ms ?? null,
      stream: ev.stream ?? false,
      requests: eventRequests(ev),
      backfilled: Boolean(ev.backfilled),
    }));

  const logEvents = events;
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    days,
    logSince: logEvents.length ? logEvents[0].ts : null,
    totals: {
      ...totals,
      activeUsers: activeUserIds.size,
      totalUsers: Object.keys(accounts.users).length,
      payingUsers: Object.values(accounts.users).filter((u) => u.subscriptionTier && u.subscriptionUntil && Date.parse(u.subscriptionUntil) > Date.now()).length,
    },
    perDay,
    sessions,
    calls,
    users: userViews.sort((a, b) => b.window.requests - a.window.requests || b.allTime.requests - a.allTime.requests),
  });
}
