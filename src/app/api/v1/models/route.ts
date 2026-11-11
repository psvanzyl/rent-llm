import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";
import { getUser } from "@/lib/accounts";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { jsonRoute } from "@/lib/http";
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";

const handler_GET = async (req: Request) => {
  const auth = req.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const rec = await validateApiKey(raw);
  if (!rec) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const owner = await getUser(rec.userId);
  if (!hasActiveSubscription(owner)) {
    return NextResponse.json({ error: "subscription_expired", message: "Subscription expired or inactive." }, { status: 402 });
  }

  const data = MODELS.map((m) => ({
    id: m.id,
    object: "model",
    owned_by: "broomy",
    display_name: m.display,
    context_length: m.contextLength,
    pricing: {
      currency: "USD",
      per_million_tokens: { input: m.pricePerMTok.input, output: m.pricePerMTok.output },
    },
  }));

  return NextResponse.json({ object: "list", data });
};

export const GET = jsonRoute("v1-models", { GET: handler_GET });
