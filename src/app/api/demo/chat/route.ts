/**
 * Public demo endpoint — anonymous, rate limited, no API key.
 *
 * Threat model (see the GTM plan, section 7.5):
 *   1. no tools, no browsing, no file access
 *   2. no secrets in the system prompt
 *   3. the request body is whitelisted to role/content messages
 *   4. upstream errors and bodies never reach the browser
 *
 * Response is a plain UTF-8 text stream, not SSE: the widget appends chunks as
 * they arrive, and there is no JSON parser to break on a partial escape.
 */
import { NextResponse } from "next/server";
import { backendModelFor } from "@/lib/models";
import { clientIp } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";
import { DEMO, demoEnabled, hashIp, originAllowed, takeSlot } from "@/lib/demo-limits";
import { REDACT_TAIL, SYSTEM_PROMPT, redact, sanitizeMessages } from "@/lib/demo-sanitize";

export const dynamic = "force-dynamic";

const UPSTREAM =
  (process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1").replace(/\/+$/, "") + "/chat/completions";
const UPSTREAM_KEY = process.env.LLM_BACKEND_KEY || "local-no-auth";

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && originAllowed(origin) ? origin : "https://laserraptor.eu",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

const handleOptions = async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!originAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: cors(origin) });
};

const handlePost = async (req: Request) => {
  const origin = req.headers.get("origin");
  // A missing Origin means a curl or a server-side call: allowed, but still
  // limited by the per-IP counter. A wrong Origin is a third-party site.
  if (origin && !originAllowed(origin)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }

  const headersOut = cors(origin);

  if (!demoEnabled()) {
    return NextResponse.json(
      { error: "demo_disabled", message: "The demo is closed right now. Write to info@laserraptor.eu." },
      { status: 503, headers: headersOut },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400, headers: headersOut });
  }

  const messages = sanitizeMessages(
    (body as { messages?: unknown })?.messages,
    DEMO.maxTurns,
    DEMO.maxChars,
  );
  if (!messages) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: `Send up to ${DEMO.maxTurns} turns of role/content messages, ${DEMO.maxChars} characters each.`,
      },
      { status: 400, headers: headersOut },
    );
  }

  const ipHash = hashIp(clientIp(req));
  const slot = await takeSlot(ipHash);
  if (!slot.ok) {
    return NextResponse.json(
      { error: slot.code, message: slot.message },
      { status: slot.status, headers: headersOut },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${UPSTREAM_KEY}` },
      body: JSON.stringify({
        model: backendModelFor(DEMO.model),
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: DEMO.maxTokens,
        temperature: 0.6,
        stream: true,
        // The engine serves a reasoning model. Without this the token budget is
        // spent on hidden reasoning and the visible answer can come back empty.
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    console.error("[broomy-demo] upstream fetch failed:", (e as Error)?.message);
    return NextResponse.json(
      { error: "engine_unavailable", message: "The engine is busy. Try again in a minute." },
      { status: 503, headers: headersOut },
    );
  }

  if (!upstream.ok || !upstream.body) {
    // Keep the upstream body in the server log only. It contains the engine URL.
    console.error("[broomy-demo] upstream status", upstream.status, (await upstream.text().catch(() => "")).slice(0, 300));
    return NextResponse.json(
      { error: "engine_error", message: "The engine could not answer. Try again in a minute." },
      { status: 503, headers: headersOut },
    );
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  let held = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        const tailText = redact(held);
        if (tailText) controller.enqueue(encoder.encode(tailText));
        console.log(
          `[broomy-demo] ok ip=${ipHash} prompt_tokens=${promptTokens} completion_tokens=${completionTokens}`,
        );
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      let delta = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const piece = obj.choices?.[0]?.delta?.content;
          if (typeof piece === "string") delta += piece;
          if (obj.usage) {
            promptTokens = obj.usage.prompt_tokens ?? promptTokens;
            completionTokens = obj.usage.completion_tokens ?? completionTokens;
          }
        } catch {
          // A partial or unknown frame: ignore it. Never forward it.
        }
      }
      if (!delta) return;
      held = redact(held + delta);
      if (held.length > REDACT_TAIL) {
        const cut = held.length - REDACT_TAIL;
        controller.enqueue(encoder.encode(held.slice(0, cut)));
        held = held.slice(cut);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...headersOut,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};

export const POST = jsonRoute("demo-chat", { POST: handlePost });
export const OPTIONS = handleOptions;
