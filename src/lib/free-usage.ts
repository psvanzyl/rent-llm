/**
 * Free-tier daily usage — per signed-in user, per day.
 *
 * Tracks image generations (cap 3/day) for free accounts. Stored on disk so
 * a redeploy or restart does not reset it. No prompt text stored.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const FREE_IMAGE_PER_DAY = 3;

function dir(): string {
  return process.env.RENT_DATA_DIR || "/app/data/accounts";
}

function file(): string {
  return path.join(dir(), "free-usage.json");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Bucket = Record<string, { images: number }>;

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
    /* missing or corrupt: start clean */
  }
  return { day: today(), bucket: {} };
}

async function write(day: string, bucket: Bucket): Promise<void> {
  await fs.mkdir(dir(), { recursive: true, mode: 0o775 }).catch(() => {});
  const target = file();
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ day, bucket }), "utf8");
  await fs.rename(tmp, target);
}

export const FREE_IMAGE_DAILY_CAP = FREE_IMAGE_PER_DAY;

export async function freeImageQuota(userId: string): Promise<{ used: number; remaining: number; cap: number }> {
  const { bucket } = await read();
  const used = bucket[userId]?.images || 0;
  return { used, remaining: Math.max(0, FREE_IMAGE_PER_DAY - used), cap: FREE_IMAGE_PER_DAY };
}

/**
 * Consume one free image slot. Returns ok=false with a message when the daily
 * cap is reached. A refusal does not consume anything.
 */
export async function takeFreeImageSlot(userId: string): Promise<{ ok: boolean; remaining: number; message?: string }> {
  return serial(async () => {
    const { day, bucket } = await read();
    const cur = bucket[userId]?.images || 0;
    if (cur >= FREE_IMAGE_PER_DAY) {
      return { ok: false, remaining: 0, message: "Daily free image limit reached (3/day). Try again tomorrow, or subscribe for unlimited." };
    }
    const next = cur + 1;
    bucket[userId] = { images: next };
    await write(day, bucket);
    return { ok: true, remaining: Math.max(0, FREE_IMAGE_PER_DAY - next) };
  });
}
