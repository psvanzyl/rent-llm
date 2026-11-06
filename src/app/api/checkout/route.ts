import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { updateUser } from "@/lib/accounts";
import { planById } from "@/lib/plans";
import { jsonRoute } from "@/lib/http";
import { originAllowed, clientIp, rateLimit, serverErrorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(req.url).origin;
}

const handler_POST = async (req: Request) => {
  if (!originAllowed(req)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const rl = rateLimit(`checkout:${clientIp(req)}`, 20, 900_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.MOLLIE_API_KEY;
  if (!key) return NextResponse.json({ error: "mollie_not_configured" }, { status: 503 });

  let body: { plan?: unknown } = {};
  try { body = (await req.json()) as { plan?: unknown }; } catch { body = {}; }
  const planId = String(body.plan ?? "basic");
  const plan = planById(planId);
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const origin = baseUrl(req);
  const amount = (plan.priceCents / 100).toFixed(2);
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    // ensure Mollie customer
    let customerId = user.mollieCustomerId;
    if (!customerId) {
      const cr = await fetch("https://api.mollie.com/v2/customers", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: user.email, email: user.email, metadata: { userId: user.id } }),
      });
      const cd = await cr.json().catch(() => ({}));
      if (!cr.ok || !cd?.id) {
        return NextResponse.json({ error: "mollie_error", detail: cd?.detail ?? `customer_${cr.status}` }, { status: 502 });
      }
      customerId = cd.id as string;
      await updateUser(user.id, { mollieCustomerId: customerId });
    }

    const payload: Record<string, unknown> = {
      amount: { currency: "EUR", value: amount },
      description: `Broomy — ${plan.name} (${plan.priceCents / 100} EUR/month)`,
      redirectUrl: `${origin}/dashboard?paid=1`,
      webhookUrl: `${origin}/api/webhook/mollie`,
      sequenceType: "first",
      customerId,
      metadata: { userId: user.id, plan: plan.id, purpose: "first-payment" },
    };

    const r = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    const url = data?._links?.checkout?.href;
    if (!r.ok || !url) {
      return NextResponse.json({ error: "mollie_error", detail: data?.detail ?? `payment_${r.status}` }, { status: 502 });
    }
    return NextResponse.json({ url, plan: plan.id, amountCents: plan.priceCents, reference: data.id });
  } catch (e) {
    return serverErrorResponse(e, "checkout");
  }
};

export const POST = jsonRoute("checkout", { POST: handler_POST });
