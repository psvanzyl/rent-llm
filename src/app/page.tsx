"use client";

import { useState } from "react";

const CODE = {
  python: `from openai import OpenAI

client = OpenAI(
    base_url="https://broomy.laserraptor.eu/api/v1",
    api_key="YOUR_API_KEY",
)

reply = client.chat.completions.create(
    model="sensei",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(reply.choices[0].message.content)`,
  js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://broomy.laserraptor.eu/api/v1",
  apiKey: process.env.BROOMY_KEY,
});

const reply = await client.chat.completions.create({
  model: "qwen3.8-flash-next-ud-q4_k_xl",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(reply.choices[0].message.content);`,
  curl: `curl https://broomy.laserraptor.eu/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"sensei","messages":[{"role":"user","content":"Hello!"}]}'`,
};

const FEATURES_BASIC = [
  "OpenAI-compatible chat completions",
  "Unlimited tokens — no caps, no overage fees",
  "1 concurrent request",
  "European-hosted, EU-only routing",
  "Cancel any month, no lock-in",
];

const FEATURES_PRO = [
  "Everything in Basic",
  "3 concurrent requests",
  "Priority queue during peak load",
  "Higher throughput window",
  "Direct support channel",
];

export default function Home() {
  const [tab, setTab] = useState<"python" | "js" | "curl">("python");

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-500/8 blur-[100px] rounded-full" />
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              European-hosted · OpenAI-compatible · Cancel monthly
            </div>
            <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
              Rent a model.<br />
              <span className="text-amber-400">Skip the GPU.</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-xl leading-relaxed">
              Two models — sensei (qwen3.8) and bonsai (qwen3.6) — served from Europe. No token limits, no per-request billing —
              just a flat monthly price and an OpenAI-compatible endpoint you can
              drop into any existing SDK.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/login" className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-300 transition">
                Get an API key
              </a>
              <a href="/docs" className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium hover:bg-white/5 transition">
                Read the docs
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Base URL: <code className="text-zinc-300">broomy.laserraptor.eu/api/v1</code>
            </p>
          </div>
        </div>
      </section>

      {/* Code example */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <h2 className="font-display text-2xl font-semibold">Drop-in replacement</h2>
            <p className="mt-3 text-zinc-400 leading-relaxed">
              Point any OpenAI SDK at Broomy. Change two lines — base URL and API key —
              and your existing code works unchanged. Streaming, function calling,
              and vision input all supported.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-xs font-bold">✓</span>
                <span>262,144 token context window</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-xs font-bold">✓</span>
                <span>Text + image input, text output</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-xs font-bold">✓</span>
                <span>Server-sent events streaming</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center text-xs font-bold">✓</span>
                <span>EU-hosted — no US or China routing</span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0d0d14] overflow-hidden shadow-2xl shadow-black/40">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
              <div className="ml-3 flex gap-1">
                {(["python", "js", "curl"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${
                      tab === t ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t === "python" ? "Python" : t === "js" ? "JavaScript" : "cURL"}
                  </button>
                ))}
              </div>
            </div>
            <pre className="p-5 text-sm leading-relaxed overflow-x-auto text-zinc-300 font-mono">
              <code>{CODE[tab]}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold">Simple, flat pricing</h2>
          <p className="mt-3 text-zinc-400">Two models. Two plans. No token limits.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Basic */}
          <div className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition hover:border-white/20">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold">Basic</h3>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Light use</span>
            </div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">€20</span>
              <span className="text-zinc-500">/month</span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">For occasional queries and small projects.</p>
            <ul className="mt-8 space-y-3 text-sm text-zinc-300">
              {FEATURES_BASIC.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a href="/login" className="mt-8 block text-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium hover:bg-white/5 transition">
              Start with Basic
            </a>
          </div>

          {/* Pro */}
          <div className="group relative rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-400/[0.06] to-transparent p-8 transition hover:border-amber-400/50">
            <div className="absolute -top-3 left-8">
              <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-black">Recommended</span>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold">Pro</h3>
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Daily use</span>
            </div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">€50</span>
              <span className="text-zinc-500">/month</span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">For daily workloads and production apps.</p>
            <ul className="mt-8 space-y-3 text-sm text-zinc-300">
              {FEATURES_PRO.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <a href="/login" className="mt-8 block text-center rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-black hover:bg-amber-300 transition">
              Start with Pro
            </a>
          </div>
        </div>
        <div className="mt-10 max-w-3xl mx-auto rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <h3 className="font-display text-lg font-semibold">Per-token pricing reference</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Plans above are flat monthly with unlimited tokens. If you pay per token elsewhere,
            these are our published rates for comparison — USD per 1M tokens.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2 text-right">Input / 1M</th>
                  <th className="px-3 py-2 text-right">Output / 1M</th>
                  <th className="px-3 py-2">Context</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 text-zinc-200">sensei (qwen3.8)</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">$0.10</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">$0.20</td>
                  <td className="px-3 py-2 text-zinc-400">262k tokens</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 text-zinc-200">bonsai (qwen3.6)</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">$0.05</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">$0.10</td>
                  <td className="px-3 py-2 text-zinc-400">65k tokens</td>
                </tr>
                <tr className="border-t border-white/5 text-zinc-500">
                  <td className="px-3 py-2">DeepSeek V4.1 Flash (official, off-peak)</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">$0.15</td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono">$0.60</td>
                  <td className="px-3 py-2">1M tokens</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            DeepSeek rates from api-docs.deepseek.com (off-peak; peak hours are double).
            On Broomy you never pay per token — the table is a comparison only.
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-600">
          Prices are net, plus statutory VAT. Cancel any month — no lock-in, no auto-renewal surprises.
        </p>
      </section>

      {/* Model specs */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
          <div className="grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs text-amber-400 uppercase tracking-widest font-medium">The models</span>
              <h2 className="font-display text-3xl font-bold mt-2">sensei (qwen3.8)</h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                The flagship: a Qwen 3.8 flash model running on European infrastructure.
                Slower than Claude or GPT-4, but unlimited tokens and a fraction of the price.
                Ideal for batch processing, code review, document analysis, and
                anything where throughput matters more than latency.
              </p>
              <h2 className="font-display text-2xl font-bold mt-6">bonsai (qwen3.6)</h2>
              <p className="mt-3 text-zinc-400 leading-relaxed">
                The fast, economical second model. Same OpenAI-compatible endpoint,
                chosen by setting the model name.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Context", value: "262k (sensei) / 65k (bonsai)" },
                { label: "Input", value: "Text + images" },
                { label: "Output", value: "Text" },
                { label: "Hosting", value: "EU only" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{s.label}</p>
                  <p className="mt-1 font-display text-lg font-semibold">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-display text-2xl font-bold text-center mb-8">Questions</h2>
        <div className="space-y-3">
          {[
            { q: "How does billing work?", a: "Flat monthly fee. Pay once, get unlimited access for 30 days. No auto-renewal — you decide when to top up." },
            { q: "Basic or Pro?", a: "Basic (€20) for light, occasional use with one concurrent request. Pro (€50) for daily workloads with three concurrent requests and priority queuing." },
            { q: "What does unlimited tokens mean?", a: "No token cap and no overage charges. The only limit is how fast the model generates — throughput, not quota." },
            { q: "Are prices including VAT?", a: "No — all prices are net, plus statutory VAT. Intended for business use." },
            { q: "Can I use the OpenAI SDK?", a: "Yes. The API is fully OpenAI-compatible. Point any SDK at our base URL with your API key and it works." },
          ].map((f) => (
            <details key={f.q} className="group rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <summary className="flex items-center justify-between cursor-pointer font-medium text-zinc-200 list-none">
                {f.q}
                <svg className="h-4 w-4 text-zinc-500 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold">Start building today.</h2>
        <p className="mt-3 text-zinc-400">No subscription minimums. No token limits. Just a model and an API key.</p>
        <div className="mt-8">
          <a href="/login" className="rounded-full bg-amber-400 px-8 py-3.5 text-sm font-semibold text-black hover:bg-amber-300 transition">
            Get your API key
          </a>
        </div>
      </section>
    </div>
  );
}
