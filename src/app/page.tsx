"use client";

import { useState } from "react";

const CODE = {
  python: `from openai import OpenAI

client = OpenAI(
    base_url="https://rent.broomy.laserraptor.eu/api/v1",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="qwen3.8-flash",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
  js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://rent.broomy.laserraptor.eu/api/v1",
  apiKey: "YOUR_API_KEY",
});

const response = await client.chat.completions.create({
  model: "qwen3.8-flash",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`,
  curl: `curl https://rent.broomy.laserraptor.eu/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen3.8-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
};

export default function Pricing() {
  const [tab, setTab] = useState<"python" | "js" | "curl">("python");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-3 text-lg text-gray-400 max-w-2xl mx-auto">
          Rent a Qwen 3.8 model via an OpenAI-compatible API. EU-hosted. No lock-in — cancel monthly.
        </p>
        <p className="mt-1 text-sm text-gray-500">Base URL <code className="text-cyan-300">https://rent.broomy.laserraptor.eu/api/v1</code></p>
      </section>

      {/* Code example */}
      <section className="mt-10">
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-hidden">
          <div className="flex border-b border-gray-800">
            {(["python", "js", "curl"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm ${tab === t ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {t === "python" ? "Python" : t === "js" ? "JavaScript" : "cURL"}
              </button>
            ))}
          </div>
          <pre className="p-4 text-sm overflow-x-auto text-gray-200">
            <code>{CODE[tab]}</code>
          </pre>
        </div>
        <div className="mt-3 text-center">
          <a href="/dashboard" className="text-sm text-cyan-400 hover:underline">Get your API key →</a>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-center mb-8">Choose your plan</h2>
        <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          {/* Basic */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 flex flex-col">
            <h3 className="text-xl font-semibold">Basic</h3>
            <p className="mt-1 text-sm text-gray-400">For lightweight workloads</p>
            <div className="mt-4">
              <span className="text-4xl font-bold">€20</span>
              <span className="text-gray-400"> /mo</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-gray-300 flex-1">
              <li>✓ OpenAI-compatible API</li>
              <li>✓ Unlimited tokens</li>
              <li>✓ 1 concurrent request</li>
              <li>✓ EU-hosted</li>
              <li>✓ No lock-in — cancel monthly</li>
            </ul>
            <p className="mt-4 text-xs text-gray-500">Unlimited tokens, limited only by model speed.</p>
            <a href="/login" className="mt-6 block text-center rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-cyan-400">
              Start Coding
            </a>
          </div>

          {/* Pro */}
          <div className="rounded-lg border border-cyan-500/50 bg-gray-900/50 p-6 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-3 py-0.5 text-xs font-medium text-black">Best value</span>
            <h3 className="text-xl font-semibold">Pro</h3>
            <p className="mt-1 text-sm text-gray-400">For your daily workloads</p>
            <div className="mt-4">
              <span className="text-4xl font-bold">€50</span>
              <span className="text-gray-400"> /mo</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-gray-300 flex-1">
              <li>✓ OpenAI-compatible API</li>
              <li>✓ Unlimited tokens</li>
              <li>✓ 3 concurrent requests</li>
              <li>✓ EU-hosted</li>
              <li>✓ No lock-in — cancel monthly</li>
              <li>✓ Priority queue</li>
            </ul>
            <p className="mt-4 text-xs text-gray-500">Unlimited tokens, limited only by model speed.</p>
            <a href="/login" className="mt-6 block text-center rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-cyan-400">
              Start Coding
            </a>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-gray-500">Prorated at checkout · All prices net, plus statutory VAT.</p>
      </section>

      {/* Model info */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-center">The model</h2>
        <div className="mt-6 max-w-2xl mx-auto rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="font-semibold text-white">Qwen 3.8 Flash</h3>
          <p className="mt-2 text-sm text-gray-400">
            A Qwen 3.8 flash model served from European infrastructure. 256k context window, vision support,
            text output. Slower than Claude Code — but unlimited tokens and a fraction of the price.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-gray-300">
            <li>• Context: 262,144 tokens</li>
            <li>• Input modalities: text + image</li>
            <li>• Output: text</li>
            <li>• EU-hosted (no US/China routing)</li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">Pricing questions</h2>
        <div className="space-y-4">
          {[
            { q: "How does billing work?", a: "Monthly subscription. Pay once per month, get unlimited access for that period. No auto-renewal surprises — cancel anytime." },
            { q: "Should I choose Basic or Pro?", a: "Basic (€20/mo) is for light, occasional use with 1 concurrent request. Pro (€50/mo) is for daily workloads with 3 concurrent requests and priority queue." },
            { q: "What does 'unlimited tokens' mean?", a: "No token cap. You can send as many tokens as you want — the only limit is how fast the model can generate (throughput), not a quota." },
            { q: "Do prices include VAT?", a: "No. All prices are net, plus statutory VAT. Intended for businesses." },
            { q: "Can I use the OpenAI SDK?", a: "Yes. The API is OpenAI-compatible. Point any OpenAI SDK at our base URL with your API key." },
          ].map((f) => (
            <div key={f.q} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <h3 className="font-medium text-white">{f.q}</h3>
              <p className="mt-1 text-sm text-gray-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 text-center">
        <h2 className="text-2xl font-bold">Top up and start building.</h2>
        <p className="mt-2 text-gray-400">No subscription minimum. Your credits work with the model on this page.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href="/login" className="rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-medium text-black hover:bg-cyan-400">
            Get started
          </a>
          <a href="/docs" className="rounded-md border border-gray-700 px-5 py-2.5 text-sm font-medium hover:bg-gray-800">
            Read the docs
          </a>
        </div>
      </section>
    </div>
  );
}
