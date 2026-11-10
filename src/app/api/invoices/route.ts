/**
 * Received invoices for the signed-in user.
 *
 * New payments are written by the Mollie webhook. Payments made before invoice
 * records existed are backfilled lazily here: their tr_ ids sit in
 * `processedPayments`, so on read we fetch any unknown id from the Mollie API
 * once and materialise it into the account store.
 */
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getUser, upsertInvoice } from "@/lib/accounts";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const MOLLIE = "https://api.mollie.com/v2";

const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let full = await getUser(user.id);
  const key = process.env.MOLLIE_API_KEY;
  const known = new Set((full?.invoices || []).map((i) => i.id));
  const missing = (full?.processedPayments || []).filter((id) => !known.has(id)).slice(0, 25);

  if (key && missing.length > 0) {
    for (const tr of missing) {
      try {
        const r = await fetch(`${MOLLIE}/payments/${tr}`, { headers: { Authorization: `Bearer ${key}` } });
        if (!r.ok) continue;
        const p = (await r.json()) as Record<string, unknown>;
        if (p.status !== "paid") continue;
        const at = (typeof p.paidAt === "string" && p.paidAt) || (typeof p.createdAt === "string" && p.createdAt) || new Date().toISOString();
        const methodRaw = Array.isArray(p.method) ? p.method[0] : p.method;
        const md = (p.metadata || {}) as { plan?: string };
        const amountCents = Math.round(parseFloat(String((p.amount as { value?: string })?.value || "0")) * 100);
        await upsertInvoice(user.id, {
          id: tr,
          at,
          amountCents,
          method: typeof methodRaw === "string" ? methodRaw : "unknown",
          plan: md.plan || "basic",
          description: typeof p.description === "string" ? p.description : undefined,
        });
      } catch {
        // one failed lookup must not blank the whole list
      }
    }
    full = await getUser(user.id);
  }

  const invoices = [...(full?.invoices || [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  const totalCents = invoices.reduce((s, i) => s + (i.amountCents || 0), 0);
  return NextResponse.json({ invoices, totalCents });
};

export const GET = jsonRoute("invoices", { GET: handler_GET });
