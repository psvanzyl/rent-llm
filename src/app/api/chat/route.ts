import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";
import { resolveModelId, backendModelFor } from "@/lib/models";
import { sanitizeMessages, redact } from "@/lib/demo-sanitize";

export const dynamic = "force-dynamic";

const MAX_TURNS = 20;
const MAX_CHARS = 4000;
const MAX_TOKENS = 512;

function backendFor(_model: string): { url: string; key: string } {
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
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data?.choices?.[0]?.message?.content || "";
  return new NextResponse(redact(content), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
};

export const POST = jsonRoute("chat", { POST: handler_POST });
