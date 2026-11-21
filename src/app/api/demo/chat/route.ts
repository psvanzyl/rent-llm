/**
 * Public demo endpoint — anonymous, rate limited, no API key.
 *
 * Threat model (GTM plan, section 7.5):
 *   1. no tools, no browsing, no file access
 *   2. no secrets in the system prompt
 *   3. the body is whitelisted to role/content messages
 *   4. upstream bodies and error text never reach the browser
 *
 * Latency model: the primary engine is single-slot and shared with paying work, so a
 * request can queue. We prime the answer first (first visible token) with a short
 * deadline, fall back to the second engine once, and only then return. A visitor
 * therefore gets either real text or an honest "busy" answer, never a blank spinner.
 *
 * The response body is a plain UTF-8 text stream: no SSE, no JSON parser in the widget.
 */
import { NextResponse } from "next/server";
import { backendModelFor } from "@/lib/models";
import { clientIp } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";
import { DEMO, demoEnabled, hashIp, originAllowed, takeSlot } from "@/lib/demo-limits";
import { REDACT_TAIL, SYSTEM_PROMPT, redact, sanitizeMessages, type DemoMessage } from "@/lib/demo-sanitize";

export const dynamic = "force-dynamic";

const PRIMARY_MODEL = process.env.DEMO_MODEL || DEMO.model;
const FALLBACK_MODEL = process.env.DEMO_FALLBACK_MODEL || "sensei";
const FIRST_TOKEN_MS = 8000;

function backendFor(model: string): { url: string; key: string; backendId: string } {
  const url = model.startsWith("bonsai")
    ? (process.env.LLM_BACKEND2_URL || "http://192.168.178.10:8087/v1")
    : (process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1");
  const key = model.startsWith("bonsai")
    ? (process.env.LLM_BACKEND2_KEY || "")
    : (process.env.LLM_BACKEND_KEY || "local-no-auth");
  return { url: url.replace(/\/+$/, "") + "/chat/completions", key, backendId: backendModelFor(model) };
}

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && originAllowed(origin) ? origin : "https://laserraptor.eu",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

type Primed = {
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  held: string;
  buf: string;
  model: string;
};

/** Pull deltas out of an SSE buffer. Never forwards unknown frames. */
function collect(buf: string, out: { text: string; prompt: number; completion: number }): string {
  const lines = buf.split("\n");
  const rest = lines.pop() || "";
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
      if (typeof piece === "string") out.text += piece;
      if (obj.usage) {
        out.prompt = obj.usage.prompt_tokens ?? out.prompt;
        out.completion = obj.usage.completion_tokens ?? out.completion;
      }
    } catch {
      /* ignore partial or unknown frames */
    }
  }
  return rest;
}

/** Read one chunk, or throw after `ms`. AbortSignal alone does not always
 *  interrupt an in-flight body read in Node, so the timeout is raced here too. */
function readWithTimeout<T>(reader: ReadableStreamDefaultReader<T>, ms: number): Promise<ReadableStreamReadResult<T>> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`read timeout after ${ms}ms`)), ms);
  });
  return Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer)) as Promise<
    ReadableStreamReadResult<T>
  >;
}

/**
 * Open an upstream stream and wait for the first visible text.
 * Returns null when nothing usable arrives before the deadline or the engine errors.
 */
async function prime(model: string, messages: DemoMessage[]): Promise<Primed | null> {
  const bk = backendFor(model);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FIRST_TOKEN_MS);
  try {
    const res = await Promise.race([
      fetch(bk.url, {
        method: "POST",
        signal: ac.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bk.key}` },
        body: JSON.stringify({
          model: bk.backendId,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          max_tokens: DEMO.maxTokens,
          temperature: 0.6,
          stream: true,
          // The engines serve reasoning models: without this the whole budget goes to
          // hidden reasoning and the visible answer can be empty.
          chat_template_kwargs: { enable_thinking: false },
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          ac.abort();
          reject(new Error("connect timeout"));
        }, FIRST_TOKEN_MS),
      ),
    ]);
    if (!res.ok || !res.body) {
      console.error("[broomy-demo] upstream", model, "status", res.status);
      return null;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const acc = { text: "", prompt: 0, completion: 0 };
    const tFirst = Date.now();

    for (;;) {
      // Wall-clock deadline, not a per-read timeout: a busy single-slot engine
      // sends keep-alive frames every few seconds and this must still give up
      // once the first visible token is not coming.
      const remaining = FIRST_TOKEN_MS - (Date.now() - tFirst);
      if (remaining <= 0) {
        reader.cancel().catch(() => {});
        return null;
      }
      const { done, value } = await readWithTimeout(reader, remaining).catch(() => {
        reader.cancel().catch(() => {});
        throw new Error("first token deadline");
      });
      if (done) {
        clearTimeout(timer);
        return acc.text ? { reader: null, held: redact(acc.text), buf: "", model } : null;
      }
      buf += decoder.decode(value, { stream: true });
      buf = collect(buf, acc);
      if (acc.text.trim().length > 0) {
        clearTimeout(timer);
        return { reader, held: redact(acc.text), buf, model };
      }
    }
  } catch (e) {
    console.error("[broomy-demo] prime failed", model, String(e).slice(0, 120));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const handleOptions = async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!originAllowed(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: cors(origin) });
};

const handlePost = async (req: Request) => {
  const origin = req.headers.get("origin");
  // No Origin means curl or a server-side call: allowed, still counted per IP.
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
  console.log(`[broomy-demo] start ip=${ipHash} turns=${messages.length}`);
  if (!slot.ok) {
    return NextResponse.json(
      { error: slot.code, message: slot.message },
      { status: slot.status, headers: headersOut },
    );
  }

  let primed = await prime(PRIMARY_MODEL, messages);
  if (!primed && FALLBACK_MODEL !== PRIMARY_MODEL) {
    primed = await prime(FALLBACK_MODEL, messages);
  }
  if (!primed) {
    return NextResponse.json(
      {
        error: "engine_busy",
        message: "Both engines are busy right now. Try again in a minute, or write to info@laserraptor.eu.",
      },
      { status: 503, headers: headersOut },
    );
  }

  const t0 = Date.now();

  // Short answer that already finished before we returned.
  if (!primed.reader) {
    console.log(`[broomy-demo] ok ip=${ipHash} model=${primed.model} ms=${Date.now() - t0} early_done=1`);
    return new Response(primed.held, {
      status: 200,
      headers: { ...headersOut, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform" },
    });
  }

  const reader = primed.reader;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = primed.buf;
  let held = primed.held;

  let idle = 0;
  const deadline = setTimeout(() => {
    reader.cancel().catch(() => {});
  }, 45000);

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await readWithTimeout(reader, 20000).catch(() => ({ done: true, value: undefined }));
      if (done) {
        if (held) controller.enqueue(encoder.encode(held));
        clearTimeout(deadline);
        console.log(`[broomy-demo] ok ip=${ipHash} model=${primed.model} ms=${Date.now() - t0}`);
        controller.close();
        return;
      }
      const before = held.length;
      if (value) {
        buf += decoder.decode(value, { stream: true });
        const acc = { text: "", prompt: 0, completion: 0 };
        buf = collect(buf, acc);
        if (acc.text) held = redact(held + acc.text);
      }
      const grew = held.length !== before;
      idle = grew ? 0 : idle + 1;

      if (held.length > REDACT_TAIL) {
        const cut = held.length - REDACT_TAIL;
        controller.enqueue(encoder.encode(held.slice(0, cut)));
        held = held.slice(cut);
      } else if (!grew && idle >= 2 && held) {
        // Engine sends keep-alive comments but no more text: the answer is complete
        // or truncated. Flush the tail so a short answer is never held back.
        controller.enqueue(encoder.encode(held));
        held = "";
      }
    },
    cancel() {
      clearTimeout(deadline);
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
