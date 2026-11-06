import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getUser } from "@/lib/accounts";
import { PLANS } from "@/lib/plans";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const full = await getUser(user.id);
  return NextResponse.json({
    active: hasActiveSubscription(full),
    tier: full?.subscriptionTier ?? null,
    until: full?.subscriptionUntil ?? null,
    plans: Object.values(PLANS),
  });
};

export const GET = jsonRoute("billing", { GET: handler_GET });
