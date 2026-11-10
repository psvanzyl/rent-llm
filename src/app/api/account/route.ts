/**
 * Account settings — the address block saved on /account.
 *
 * GET   returns the saved billing address plus plan state for the overview.
 * PATCH stores the address. Fields are whitelisted, trimmed, and length-capped;
 * anything else in the body is ignored.
 */
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getUser } from "@/lib/accounts";
import { saveAccountInfo, type AccountInfo } from "@/lib/accounts";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { jsonRoute } from "@/lib/http";
import { originAllowed, clientIp, rateLimit } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** field -> max length. Country must be a 2-letter ISO code from the page's list. */
const FIELD_MAX: Record<keyof AccountInfo, number> = {
  company: 120,
  contactName: 120,
  street: 160,
  zip: 16,
  city: 80,
  country: 2,
  vatId: 24,
};

const COUNTRIES = [
  "NL", "BE", "DE", "FR", "GB", "IT", "ES", "PT", "IE", "LU",
  "AT", "CH", "SE", "NO", "DK", "FI", "PL", "CZ", "HU", "RO",
  "US", "CA", "AU",
];

function sanitizeAccountInfo(body: Record<string, unknown>): AccountInfo | { error: string } {
  const out: AccountInfo = {};
  for (const key of Object.keys(FIELD_MAX) as (keyof AccountInfo)[]) {
    const raw = body[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") return { error: `invalid_${key}` };
    const v = raw.trim();
    if (v.length > FIELD_MAX[key]) return { error: `${key}_too_long` };
    if (key === "country") {
      const code = v.toUpperCase();
      if (code && !COUNTRIES.includes(code)) return { error: "invalid_country" };
      out.country = code;
    } else {
      out[key] = v;
    }
  }
  return out;
}

const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const full = await getUser(user.id);
  return NextResponse.json({
    user: { email: user.email, name: user.name, createdAt: user.createdAt },
    accountInfo: full?.accountInfo ?? null,
    plan: {
      active: hasActiveSubscription(full),
      tier: full?.subscriptionTier ?? null,
      until: full?.subscriptionUntil ?? null,
    },
    invoiceCount: full?.invoices?.length ?? 0,
    totalPaidCents: (full?.invoices || []).reduce((s, i) => s + (i.amountCents || 0), 0),
  });
};

const handler_PATCH = async (req: Request) => {
  if (!originAllowed(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  const rl = rateLimit(`account:${clientIp(req)}`, 30, 600_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const sanitized = sanitizeAccountInfo(body);
  if ("error" in sanitized) return NextResponse.json({ error: sanitized.error }, { status: 400 });

  const saved = await saveAccountInfo(user.id, sanitized);
  return NextResponse.json({ ok: true, accountInfo: saved });
};

export const GET = jsonRoute("account", { GET: handler_GET });
export const PATCH = jsonRoute("account-patch", { PATCH: handler_PATCH });
