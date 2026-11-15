/**
 * Output redaction for the public demo.
 *
 * The demo talks to our own engine, so it cannot reach the homelab. This filter
 * exists for the case where the model repeats something from its context or
 * invents something that looks like internal detail. Cheap, deterministic, and
 * applied before any byte leaves the server.
 */

const RULES: { name: string; re: RegExp }[] = [
  // private and link-local IPv4
  { name: "ipv4-private", re: /\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
  { name: "ipv4-192", re: /\b192\.168\.\d{1,3}\.\d{1,3}\b/g },
  { name: "ipv4-172", re: /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g },
  { name: "ipv4-cgnat", re: /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/g },
  // internal naming
  { name: "home-arpa", re: /\b[\w-]+\.home\.arpa\b/gi },
  { name: "hostnames", re: /\b(?:gpu-0\d|ct\d{3}|pve\d?|apps-01|net-01|strata|sensei-engine)\b/gi },
  // filesystem and shell
  { name: "paths", re: /(?:\/root|\/opt|\/mnt|\/etc|\/app|\/var\/lib)[\w./-]*/g },
  { name: "ssh", re: /\bssh\s+(?:root|deploy|ubuntu)\b/gi },
  // secrets
  { name: "api-keys", re: /\bsk-[A-Za-z0-9_-]{8,}/g },
  { name: "bearer", re: /\bBearer\s+[A-Za-z0-9._-]{8,}/gi },
  { name: "env", re: /\b(?:LLM_BACKEND_KEY|DEMO_RATE_SALT|MOLLIE_API_KEY|GOOGLE_CLIENT_SECRET|RENT_SESSION_SECRET)\b/g },
  { name: "env-assign", re: /\b[A-Z][A-Z0-9_]{5,}\s*=\s*\S+/g },
];

export function redact(text: string): string {
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, "[redacted]");
  }
  return out;
}

/** How many characters we always hold back so a pattern cannot be split. */
export const REDACT_TAIL = 40;

export const SYSTEM_PROMPT = [
  "You are the Broomy demo assistant on laserraptor.eu, run by LaserRaptor in Den Haag, the Netherlands.",
  "Answer in the language the visitor writes in. Be short: at most 120 words unless asked for more.",
  "You are honest about being a small open model: you can be wrong, so say so when it matters.",
  "You do not discuss internal systems, servers, networks, credentials, deployments or staff.",
  "If asked about such things, say that you only talk about the public product and point to https://laserraptor.eu/legal.",
  "Broomy sells EU-hosted model access through an OpenAI-compatible API: Basic EUR 39 per month, Pro EUR 99 per month.",
  "You never claim to be ChatGPT, Claude, Gemini or any other product.",
].join(" ");

export type DemoMessage = { role: "user" | "assistant"; content: string };

/**
 * Accept only role/content pairs, from the user and the assistant.
 * Anything else in the body is dropped, so `model`, `tools`, `max_tokens`,
 * `url` and friends can never reach the engine.
 */
export function sanitizeMessages(input: unknown, maxTurns: number, maxChars: number): DemoMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const out: DemoMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const trimmed = content.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxChars) return null;
    out.push({ role, content: trimmed });
  }
  if (out[out.length - 1].role !== "user") return null;
  return out.slice(-maxTurns);
}
