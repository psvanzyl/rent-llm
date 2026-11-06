import { NextResponse } from "next/server";
import { getUser, updateUser } from "@/lib/accounts";
import { PLANS, planById } from "@/lib/plans";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const MOLLIE = "https://api.mollie.com/v2";

async function mollieGet(path: string, key: string) {
  const r = await fetch(`${MOLLIE}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

async function molliePost(path: string, key: string, body: unknown) {
  const r = await fetch(`${MOLLIE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

async function mollieCreateSubscription(userId: string, customerId: string, key: string, planId: string) {
  const plan = planById(planId) || PLANS.basic;
  const origin = (process.env.APP_URL || "https://broomy.laserraptor.eu").replace(/\/$/, "");
  const { ok, status, data } = await molliePost(`/customers/${customerId}/subscriptions`, key, {
    amount: { currency: "EUR", value: (plan.priceCents / 100).toFixed(2) },
    interval: "1 month",
    description: `Broomy — ${plan.name}`,
    webhookUrl: `${origin}/api/webhook/mollie`,
    metadata: { userId, plan: plan.id, purpose: "renewal" },
  });
  if (!ok || !data?.id) {
    console.error(`mollie subscription create failed (${status}):`, JSON.stringify(data));
    return null;
  }
  await updateUser(userId, { mollieSubscriptionId: data.id });
  return data.id as string;
}

const handler_POST = async (req: Request) => {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });

  let id = "";
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    id = ((await req.json().catch(() => ({}))) as { id?: string })?.id || "";
  } else {
    id = new URLSearchParams(await req.text()).get("id") || "";
  }

  if (/^sub_[A-Za-z0-9]+$/.test(id)) {
    const { ok, data } = await mollieGet(`/subscriptions/${id}`, key);
    if (!ok) return NextResponse.json({ error: "sub_lookup_failed" }, { status: 502 });
    return NextResponse.json({ received: true, kind: "subscription", status: data?.status });
  }

  if (!/^tr_[A-Za-z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const { ok, data: p } = await mollieGet(`/payments/${id}`, key);
  if (!ok) return NextResponse.json({ error: "mollie_lookup_failed" }, { status: 502 });
  if (p.status !== "paid") return NextResponse.json({ received: true, status: p.status });

  const md = (p.metadata || {}) as { userId?: string; plan?: string; purpose?: string };
  const planId = md.plan || "basic";
  const plan = planById(planId) || PLANS.basic;
  const amountCents = Math.round(parseFloat(p.amount?.value || "0") * 100);

  let userId: string | undefined = md.userId;
  if (!userId && md.purpose !== "first-payment") {
    const customerId: string | undefined = p.customerId || p.customer?.id;
    if (customerId) {
      // find user by mollieCustomerId
      // read accounts store
      const { readAccounts } = await import("@/lib/accounts");
      const store = await readAccounts();
      userId = Object.values(store.users).find((u) => u.mollieCustomerId === customerId)?.id;
    }
  }
  if (!userId) return NextResponse.json({ received: true, ignored: "no_user" });
  const user = await getUser(userId);
  if (!user) return NextResponse.json({ received: true, ignored: "unknown_user" });

  const processed = user.processedPayments || [];
  if (processed.includes(id)) return NextResponse.json({ received: true, duplicate: true });

  // grant access
  const until = new Date(Date.now() + plan.accessDays * 24 * 3600 * 1000).toISOString();
  await updateUser(userId, {
    subscriptionTier: plan.id,
    subscriptionUntil: until,
    processedPayments: [...processed, id],
  });

  // first payment -> create recurring subscription
  if (md.purpose === "first-payment" && !user.mollieSubscriptionId && user.mollieCustomerId) {
    const sub = await mollieCreateSubscription(userId, user.mollieCustomerId, key, plan.id);
    if (sub) return NextResponse.json({ received: true, granted: plan.id, userId, subscription: sub });
    return NextResponse.json({ received: true, granted: plan.id, userId, subscription_pending: true });
  }
  return NextResponse.json({ received: true, granted: plan.id, userId });
};

export const POST = jsonRoute("webhook-mollie", { POST: handler_POST });
