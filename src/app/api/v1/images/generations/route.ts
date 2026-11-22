import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";
import { getUser } from "@/lib/accounts";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_POST = async (req: Request) => {
  const auth = req.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (req.headers.get("x-api-key") || "");
  const rec = await validateApiKey(raw);
  if (!rec) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const owner = await getUser(rec.userId);
  if (!hasActiveSubscription(owner)) {
    return NextResponse.json({ error: "subscription_expired", message: "Subscription expired or inactive." }, { status: 402 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const prompt = (body as { prompt?: string })?.prompt || "";
  const width = (body as { width?: number })?.width || 512;
  const height = (body as { height?: number })?.height || 512;
  const steps = (body as { steps?: number })?.steps || 20;

  const backendUrl = process.env.IMAGE_BACKEND_URL || "http://192.168.178.10:8088";

  let upstream: Response;
  try {
    upstream = await fetch(backendUrl + "/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, width, height, steps }),
    });
  } catch (e) {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json" } });
  }

  const data = await upstream.json();
  return NextResponse.json({
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: data.image }],
  });
};

export const POST = jsonRoute("v1-images", { POST: handler_POST });
