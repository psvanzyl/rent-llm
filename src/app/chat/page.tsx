"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

// Type "draw a fox" / "maak een afbeelding van ..." and hit Enter -> image.
// Keyword-based on purpose: predictable, no extra LLM call.
function imageIntent(text: string): string | null {
  const t = text.trim();
  let m;
  if ((m = t.match(/^(?:draw|sketch|illustrate)\s+(?:me\s+)?(?:a|an|the)?\s*(?!(?:conclusions?)\b)(.+)/i))) return m[1];
  if ((m = t.match(/^(?:generate|create|make|render)\s+(?:an?\s+)?(?:image|picture|photo|drawing|painting)\s+(?:of|showing|with|for)?\s+(.+)/i))) return m[1];
  if ((m = t.match(/^(?:picture|image)\s+of\s+(.+)/i))) return m[1];
  if ((m = t.match(/^imagine\s+(.+)/i))) return m[1];
  if ((m = t.match(/^teken\s+(?:me\s+)?(?:een\s+|de\s+)?(.+)/i))) return m[1];
  if ((m = t.match(/^(?:genereer|maak)\s+(?:me\s+)?(?:een\s+)?(?:afbeelding|plaatje|foto|image)\s+(?:van\s+|met\s+)?(.+)/i))) return m[1];
  if ((m = t.match(/^mal\s+ein\s+bild\s+(?:von\s+)?(.+)/i))) return m[1];
  return null;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgProgress, setImgProgress] = useState(0);
  const [imgElapsed, setImgElapsed] = useState(0);
  const [imgQuota, setImgQuota] = useState<{ used: number; remaining: number; cap: number } | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) { router.push("/login"); return; }
      const d = await me.json();
      setUser(d.user);
      const q = await fetch("/api/images/generate");
      if (q.ok) setImgQuota(await q.json());
    })();
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function runImage(prompt: string) {
    setImgBusy(true);
    setImgErr(null);
    setImgProgress(0);
    setImgElapsed(0);
    const t0 = Date.now();
    const timer = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      setImgElapsed(Math.floor(el));
      setImgProgress(Math.min(90, Math.round((1 - Math.exp(-el / 15)) * 90)));
    }, 500);
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImgErr(data?.message || data?.error || "Image generation failed.");
        setMessages((prev) => [...prev, { role: "assistant", content: "Image generation failed: " + (data?.message || data?.error || "please try again.") }]);
        return;
      }
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Generated image for: "${prompt}"`, image: b64 }]);
      }
      if (data.remaining !== undefined) {
        setImgQuota((q) => q ? { ...q, used: q.cap - data.remaining, remaining: data.remaining } : { used: 3 - data.remaining, remaining: data.remaining, cap: 3 });
      }
    } catch {
      setImgErr("Network error.");
      setMessages((prev) => [...prev, { role: "assistant", content: "Image generation failed: network error. Try again." }]);
    } finally {
      clearInterval(timer);
      setImgProgress(100);
      setImgBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || imgBusy) return;
    const img = imageIntent(text);
    setInput("");
    if (img) {
      setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
      await runImage(img);
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })), model: "sensei" }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: t || "Error: request failed." };
          return copy;
        });
        setStreaming(false);
        return;
      }
      const text = await res.text();
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: text };
        return copy;
      });
    } catch (e) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Network error." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  if (!user) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-gray-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Chat</h1>
          <p className="text-sm text-gray-400">{user.email} · free account</p>
        </div>
        <div className="text-sm text-gray-400">
          {imgQuota ? `${imgQuota.remaining}/${imgQuota.cap} images left today. Try "draw a fox"` : "sensei (qwen3.8)"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/30 p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            Start a conversation. Ask anything, or generate an image: type <span className="text-violet-400">"draw a fox"</span> and press Enter.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-amber-500 text-black"
                  : "bg-gray-800 text-gray-100 border border-gray-700"
              }`}
            >
              {m.content}
              {m.image && (
                <img
                  src={`data:image/png;base64,${m.image}`}
                  alt="generated"
                  className="mt-2 rounded-lg max-w-full"
                />
              )}
              {m.role === "assistant" && imgBusy && i === messages.length - 1 && !m.image && (
                <span className="block mt-2">
                  <span className="inline-flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    Generating image… {imgElapsed}s
                  </span>
                  <span className="block mt-1 h-1.5 w-40 rounded-full bg-gray-700 overflow-hidden">
                    <span className="block h-full bg-violet-500 transition-all duration-500" style={{ width: imgProgress + "%" }} />
                  </span>
                </span>
              )}
              {m.role === "assistant" && streaming && i === messages.length - 1 && (
                <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        {imgErr && <p className="text-xs text-red-400">{imgErr}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message… or 'draw a fox'"
          disabled={streaming || imgBusy}
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={streaming || imgBusy || !input.trim()}
          className="rounded-md bg-amber-500 px-5 py-2.5 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {imgBusy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
