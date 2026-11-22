"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string; // base64 PNG from image generation
}

const GUEST_KEY = "broomy_demo_messages";

// Say "draw a fox" / "generate an image of ..." in the chat and it goes to the
// image model. Keyword-based on purpose: predictable, no extra LLM call.
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [imgQuota, setImgQuota] = useState<{ used: number; remaining: number; cap: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    // Demo visitors run on localStorage (guest mode). Signed-in users get the real /api/chat.
    const guest = typeof localStorage !== "undefined" && localStorage.getItem(GUEST_KEY) === "1";
    if (guest) {
      setUser({ email: "demo@guest", role: "demo" });
      try {
        const raw = localStorage.getItem(GUEST_KEY + ":msgs");
        if (raw) setMessages(JSON.parse(raw));
      } catch {}
      return;
    }
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u) => {
        setUser(u);
        fetch("/api/images/generate", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setImgQuota);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (user?.role === "demo") {
      try { localStorage.setItem(GUEST_KEY + ":msgs", JSON.stringify(messages.slice(-20))); } catch {}
    }
  }, [messages, user]);

  async function send() {
    const text = input.trim();
    if (!text || busy || !user) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    const img = user.role !== "demo" ? imageIntent(text) : null;
    if (img) return sendImage(text, img);
    setBusy(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      if (user.role === "demo") {
        // Guest: demo endpoint is anonymous and rate-limited; no account, no keys.
        const res = await fetch("/api/demo/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
        });
        if (res.status === 429) {
          const j = await res.json().catch(() => ({}));
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Demo rate limit reached: " + (j.error || "try again later") + ". Create a free account for the full chat." }]);
          return;
        }
        if (!res.ok || !res.body) {
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "The demo is busy right now — try again in a minute." }]);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const piece = dec.decode(value, { stream: true });
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + piece }]);
        }
      } else {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: text }], model: "sensei" }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Error: " + (j.error || res.status) }]);
          return;
        }
        const text0 = await res.text();
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: text0 }]);
      }
    } catch {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Network error — is the engine up?" }]);
    } finally {
      setBusy(false);
    }
  }

  // Image ask from the chat box: uses the same free daily quota as the old image box.
  async function sendImage(shown: string, prompt: string) {
    if (imgQuota && imgQuota.remaining <= 0) {
      setMessages((m) => [...m, { role: "assistant", content: "You have used all " + imgQuota.cap + " free images for today. They reset at midnight." }]);
      return;
    }
    setBusy(true);
    setMessages((m) => [...m, { role: "assistant", content: "Generating an image (~1–2 min)…" }]);
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "You have used all " + (data.cap ?? 3) + " free images for today. They reset at midnight." }]);
      } else if (!res.ok) {
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Image generation failed: " + (data.error || res.status) }]);
      } else {
        setImgQuota({ used: data.used, remaining: data.remaining, cap: data.cap });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Here you go.", image: data.image }]);
      }
    } catch {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Image generation failed — network error." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 bg-ink-2/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display font-bold text-lg">
            broomy<span className="text-amber-400">.</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {imgQuota && (
              <span className="text-zinc-500">{imgQuota.remaining}/{imgQuota.cap} free images today</span>
            )}
            {user.role === "demo" ? (
              <span className="text-amber-300">demo · no account</span>
            ) : (
              <span className="text-zinc-400">{user.email}</span>
            )}
            <Link href="/dashboard" className="text-zinc-400 hover:text-amber-300">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-6 flex flex-col gap-3">
        <div className="text-xs text-zinc-500 mb-2">
          Free account · sensei (qwen3.8) · say “draw a fox” to generate an image
        </div>
        {messages.length === 0 && (
          <div className="text-zinc-500 text-sm mt-8 text-center">
            <p>Ask me anything. I remember you between sessions.</p>
            <p className="mt-1">Try: “draw a red fox” · “explain this code” · “what can you do?”</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-lg bg-amber-500/10 border border-amber-400/20 px-4 py-2 text-sm text-zinc-100 whitespace-pre-wrap"
                : "self-start max-w-[85%] rounded-lg bg-white/5 border border-white/5 px-4 py-2 text-sm text-zinc-200 whitespace-pre-wrap"
            }
          >
            {m.image && (
              <img
                src={"data:image/png;base64," + m.image}
                alt="generated image"
                className="rounded-md mb-2 max-w-full"
                style={{ maxHeight: 512 }}
              />
            )}
            {m.content}
          </div>
        ))}
        {busy && <div className="self-start text-zinc-500 text-sm px-1">…</div>}
        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-white/5 bg-ink-2/80 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-6 py-3 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message… (or ask: draw a red fox)"
            rows={2}
            className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400/40 resize-none"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="px-4 rounded-lg bg-amber-500 text-black text-sm font-semibold disabled:opacity-40 self-end"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
