/**
 * Demo chat limits — the public, anonymous endpoint on the parent site.
 *
 * Design rule: the demo must never become a free API. All limits live on disk,
 * so a redeploy or a restart does not reset them. No prompt text is stored.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const DEMO = {
  /** max history turns we forward upstream */
  maxTurns: 4,
  /** max characters per user turn */
  maxChars: 1500,
  /** max output tokens */
  maxTokens: 300,
  /** turns a single browser session may send */
  sessionTurns: 6,
  /** messages a single IP may send per day */
  ipPerDay: 12,
  /** hard cap for every visitor together, per day */
  globalPerDay: 400,
  /** model shown and used in the demo; the client cannot change it */
  model: "bonsai",
} as const;

export function demoEnabled(): boolean {
  const v = (process.env.DEMO_ENABLED ?? "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const ALLOWED_ORIGINS = [
  "https://laserraptor.eu",
  "https://www.laserraptor.eu",
  "http://localhost:3000",
];

export function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/** sha256(salt + ip), first 16 hex chars. The raw IP is never written. */
export function hashIp(ip: string): string {
  const salt = process.env.DEMO_RATE_SALT || "broomy-demo";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

type Bucket = { ip: Record<string, number>; global: number };

function dir(): string {
  return process.env.RENT_DATA_DIR || "/app/data/accounts";
}

function file(): string {
  return path.join(dir(), "demo-usage.json");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Serialised read-modify-write. One process, so an async queue is enough. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function read(): Promise<{ day: string; bucket: Bucket }> {
  try {
    const raw = await fs.readFile(file(), "utf8");
    const parsed = JSON.parse(raw) as { day?: string; bucket?: Bucket };
    if (parsed.day === today() && parsed.bucket) {
      return { day: parsed.day, bucket: parsed.bucket };
    }
  } catch {
    /* missing or corrupt file: start clean */
  }
  return { day: today(), bucket: { ip: {}, global: 0 } };
}

async function write(day: string, bucket: Bucket): Promise<void> {
  await fs.mkdir(dir(), { recursive: true, mode: 0o775 }).catch(() => {});
  const target = file();
  const tmp = `${target}.${process.pid}.tmp`;
  const handle = await fs.open(tmp, "w", 0o600);
  try {
    await handle.writeFile(JSON.stringify({ day, bucket }), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, target);
}

export type DemoVerdict =
  | { ok: true; remaining: number }
  | { ok: false; status: 429 | 503; code: string; message: string };

/**
 * Count one message against the per-IP and global buckets, or refuse.
 * A refusal does not consume anything.
 */
export async function takeSlot(ipHash: string): Promise<DemoVerdict> {
  return serial(async () => {
    const { day, bucket } = await read();
    const ipCount = bucket.ip[ipHash] || 0;

    if (bucket.global >= DEMO.globalPerDay) {
      return {
        ok: false,
        status: 503,
        code: "demo_capacity",
        message: "The demo is at capacity for today. Email info@laserraptor.eu for a pilot.",
      };
    }
    if (ipCount >= DEMO.ipPerDay) {
      return {
        ok: false,
        status: 429,
        code: "demo_ip_limit",
        message: "Daily demo limit reached for this connection. Email info@laserraptor.eu for a pilot.",
      };
    }

    bucket.ip[ipHash] = ipCount + 1;
    bucket.global += 1;
    await write(day, bucket);
    return { ok: true, remaining: Math.max(0, DEMO.ipPerDay - bucket.ip[ipHash]) };
  });
}
