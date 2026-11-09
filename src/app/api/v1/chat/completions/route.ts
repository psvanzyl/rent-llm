import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";
import { getUser } from "@/lib/accounts";
import { hasActiveSubscription, tierConcurrent } from "@/lib/subscriptions";
import { recordUsage } from "@/lib/usage";
import { jsonRoute } from "@/lib/http";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BACKEND = process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1";
const BACKEND_KEY = process.env.LLM_BACKEND_KEY || "local-no-auth";

const inflight = new Map<string, number>();

const handler_POST = async (req: Request) => {
  const auth = req.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (req.headers.get("x-api-key") || "");
  const rec = await validateApiKey(raw);
  if (!rec) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const owner = await getUser(rec.userId);
  if (!hasActiveSubscription(owner)) {
    return NextResponse.json({ error: "subscription_expired", message: "Subscription expired or inactive." }, { status: 402 });
  }
  const limit = tierConcurrent(owner);
  const current = inflight.get(rec.userId) || 0;
  if (limit > 0 && current >= limit) {
    return NextResponse.json({ error: "concurrency_limit", message: "Too many concurrent requests for your plan." }, { status: 429 });
  }
  inflight.set(rec.userId, current + 1);

  let body: unknown;
  const t0 = Date.now();
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const stream = (body as { stream?: boolean })?.stream === true;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BACKEND_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    inflight.set(rec.userId, Math.max(0, (inflight.get(rec.userId) || 1) - 1));
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    inflight.set(rec.userId, Math.max(0, (inflight.get(rec.userId) || 1) - 1));
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json" } });
  }

  if (!stream) {
    const data = (await upstream.json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } };
    const pt = data?.usage?.prompt_tokens ?? 0;
    const ct = data?.usage?.completion_tokens ?? 0;
    const ca = data?.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    recordUsage(rec.id, pt, ct, { userId: rec.userId, keyName: rec.name, model: (body as { model?: string })?.model, ip: clientIp(req), stream: false, cached: ca, ms: Date.now() - t0 }).catch(() => {});
    inflight.set(rec.userId, Math.max(0, (inflight.get(rec.userId) || 1) - 1));
    return NextResponse.json(data);
  }

  // Streaming: tee the stream to track usage from the final chunk, pass through to client.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let cachedTokens = 0;

  const readable = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        recordUsage(rec.id, promptTokens, completionTokens, { userId: rec.userId, keyName: rec.name, model: (body as { model?: string })?.model, ip: clientIp(req), stream: true, cached: cachedTokens, ms: Date.now() - t0 }).catch(() => {});
        inflight.set(rec.userId, Math.max(0, (inflight.get(rec.userId) || 1) - 1));
        return;
      }
      controller.enqueue(value);
      // parse SSE for usage
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as { usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } };
          if (obj?.usage) {
            promptTokens = obj.usage.prompt_tokens ?? promptTokens;
            completionTokens = obj.usage.completion_tokens ?? completionTokens;
            cachedTokens = obj.usage.prompt_tokens_details?.cached_tokens ?? cachedTokens;
          }
        } catch {
          // ignore parse errors
        }
      }
    },
    cancel() {
      reader.cancel();
      inflight.set(rec.userId, Math.max(0, (inflight.get(rec.userId) || 1) - 1));
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};

export const POST = jsonRoute("v1-chat", { POST: handler_POST });
