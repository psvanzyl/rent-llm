import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";
import { resolveModelId, backendModelFor } from "@/lib/models";
import { sanitizeMessages, redact, REDACT_TAIL, type DemoMessage } from "@/lib/demo-sanitize";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_TURNS = 20;
const MAX_CHARS = 4000;
const MAX_TOKENS = 1024;

function backendFor(model: string): { url: string; key: string } {
  if (model.startsWith("bonsai")) {
    return {
      url: process.env.LLM_BACKEND2_URL || "http://192.168.178.10:8087/v1",
      key: process.env.LLM_BACKEND2_KEY || "",
    };
  }
  return {
    url: process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1",
    key: process.env.LLM_BACKEND_KEY || "local-no-auth",
  };
}

const SYSTEM_PROMPT =
  "You are the Broomy assistant, a helpful AI chatbot by LaserRaptor (Den Haag, NL). " +
  "Answer in the language the user writes in. Be concise but complete. " +
  "You never claim to be ChatGPT, Claude, Gemini or any other product. " +
  "You do not discuss internal systems, servers, networks, or credentials.";

const handler_POST = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to chat." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const messages = sanitizeMessages((body as { messages?: unknown })?.messages, MAX_TURNS, MAX_CHARS);
  if (!messages) {
    return NextResponse.json(
      { error: "bad_request", message: `Send up to ${MAX_TURNS} turns, ${MAX_CHARS} chars each, ending with a user message.` },
      { status: 400 },
    );
  }

  const requestedModel = (body as { model?: string })?.model || "sensei";
  const model = resolveModelId(requestedModel);
  const bk = backendFor(model);
  const upstreamUrl = bk.url.replace(/\/+$/, "") + "/chat/completions";

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + bk.key },
      body: JSON.stringify({
        model: backendModelFor(model),
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        stream: true,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  let held = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        if (held) controller.enqueue(encoder.encode(held));
        controller.close();
        return;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      let grew = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
          const piece = obj.choices?.[0]?.delta?.content;
          if (typeof piece === "string") {
            held = redact(held + piece);
            grew = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (held.length > REDACT_TAIL) {
        const cut = held.length - REDACT_TAIL;
        controller.enqueue(encoder.encode(held.slice(0, cut)));
        held = held.slice(cut);
      } else if (!grew && held) {
        // flush small tail when no more text arrives this chunk cycle handled by next
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};

export const POST = jsonRoute("chat", { POST: handler_POST });
