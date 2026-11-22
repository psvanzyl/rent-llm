import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";
import { freeImageQuota, takeFreeImageSlot } from "@/lib/free-usage";

export const dynamic = "force-dynamic";

const handler_POST = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to generate images." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const prompt = String((body as { prompt?: unknown })?.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "bad_request", message: "Prompt is required." }, { status: 400 });
  }
  const width = Number((body as { width?: unknown })?.width) || 512;
  const height = Number((body as { height?: unknown })?.height) || 512;
  const steps = Number((body as { steps?: unknown })?.steps) || 20;

  const quota = await freeImageQuota(user.id);
  if (quota.remaining <= 0) {
    return NextResponse.json(
      { error: "image_quota_exhausted", message: "Daily free image limit reached (3/day). Try again tomorrow, or subscribe for unlimited.", used: quota.used, cap: quota.cap },
      { status: 429 },
    );
  }

  const backendUrl = process.env.IMAGE_BACKEND_URL || "http://192.168.178.170:8088";
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

  const data = (await upstream.json()) as { image: string };
  const slot = await takeFreeImageSlot(user.id);
  return NextResponse.json({
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: data.image }],
    remaining: slot.remaining,
    cap: 3,
  });
};

export const POST = jsonRoute("images-generate", { POST: handler_POST });

// GET quota
const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = await freeImageQuota(user.id);
  return NextResponse.json(q);
};

export const GET = jsonRoute("images-quota", { GET: handler_GET });
