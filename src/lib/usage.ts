import { promises as fs } from "node:fs";
import path from "node:path";

export interface UsageRecord {
  keyId: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  lastUsedAt?: string;
}

interface UsageStore {
  usage: Record<string, UsageRecord>;
}

/** Extra context attached to one API call, recorded in the per-request event log. */
export interface UsageMeta {
  userId: string;
  keyName?: string;
  model?: string;
  ip?: string;
  stream?: boolean;
}

/** One line in usage-log.jsonl — a single completed API request. */
export interface UsageEvent {
  ts: string;
  keyId: string;
  userId: string;
  keyName?: string;
  model?: string;
  pt: number;
  ct: number;
  ip?: string;
  stream?: boolean;
}

function dataDir(): string {
  return process.env.RENT_DATA_DIR || "/app/data/accounts";
}

async function ensureDir(): Promise<void> {
  const dir = dataDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o775 }).catch(() => {});
}

function usagePath(): string {
  return path.join(dataDir(), "usage.json");
}

function logPath(): string {
  return path.join(dataDir(), "usage-log.jsonl");
}

async function readStore(): Promise<UsageStore> {
  await ensureDir();
  let raw: string;
  try {
    raw = await fs.readFile(usagePath(), "utf8");
  } catch (e) {
    if ((e as { code?: string })?.code === "ENOENT") return { usage: {} };
    throw e;
  }
  try {
    const parsed = JSON.parse(raw) as UsageStore;
    return { usage: parsed.usage || {} };
  } catch (e) {
    throw new Error(`usage store corrupt: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

async function writeStore(store: UsageStore): Promise<void> {
  await ensureDir();
  const tmp = `${usagePath()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store), "utf8");
  await fs.rename(tmp, usagePath());
}

/**
 * Append one event to the JSONL request log. Append-only, so concurrent requests
 * cannot clobber each other's lines. A failed log write must never break the API
 * response — callers fire-and-forget this.
 */
async function appendEvent(ev: UsageEvent): Promise<void> {
  await ensureDir();
  await fs.appendFile(logPath(), JSON.stringify(ev) + "\n", "utf8");
}

/** Serialise log appends so ordering stays sane under load. */
let logChain: Promise<void> = Promise.resolve();
function appendLogged(ev: UsageEvent): Promise<void> {
  const done = logChain.then(() => appendEvent(ev), () => appendEvent(ev));
  logChain = done.then(() => undefined, () => undefined);
  return done;
}

export async function recordUsage(
  keyId: string,
  promptTokens: number,
  completionTokens: number,
  meta?: UsageMeta,
): Promise<void> {
  const store = await readStore();
  const cur = store.usage[keyId] || { keyId, requests: 0, promptTokens: 0, completionTokens: 0 };
  cur.requests += 1;
  cur.promptTokens += promptTokens || 0;
  cur.completionTokens += completionTokens || 0;
  cur.lastUsedAt = new Date().toISOString();
  store.usage[keyId] = cur;
  await writeStore(store);
  if (meta) {
    await appendLogged({
      ts: cur.lastUsedAt,
      keyId,
      userId: meta.userId,
      keyName: meta.keyName,
      model: meta.model,
      pt: promptTokens || 0,
      ct: completionTokens || 0,
      ip: meta.ip,
      stream: meta.stream,
    });
  }
}

export async function getUsage(keyId: string): Promise<UsageRecord> {
  const store = await readStore();
  return store.usage[keyId] || { keyId, requests: 0, promptTokens: 0, completionTokens: 0 };
}

export async function getUsageForKeys(keyIds: string[]): Promise<Record<string, UsageRecord>> {
  const store = await readStore();
  const out: Record<string, UsageRecord> = {};
  for (const id of keyIds) {
    out[id] = store.usage[id] || { keyId: id, requests: 0, promptTokens: 0, completionTokens: 0 };
  }
  return out;
}

/** Prune the log when it grows past this many bytes. */
const LOG_MAX_BYTES = 5 * 1024 * 1024;
/** Keep this many days of history when pruning. */
const LOG_KEEP_DAYS = 120;

/**
 * Read the per-request event log. Torn or malformed lines are skipped.
 * If the file has grown past LOG_MAX_BYTES, it is rewritten keeping only the
 * last LOG_KEEP_DAYS days — cheap self-retention, run by whoever reads it
 * (the admin endpoint), not by a separate cron.
 */
export async function readUsageLog(): Promise<UsageEvent[]> {
  await ensureDir();
  let raw: string;
  try {
    raw = await fs.readFile(logPath(), "utf8");
  } catch (e) {
    if ((e as { code?: string })?.code === "ENOENT") return [];
    throw e;
  }
  const events: UsageEvent[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const ev = JSON.parse(t) as UsageEvent;
      if (ev && typeof ev.ts === "string" && typeof ev.keyId === "string") events.push(ev);
    } catch {
      // skip torn line
    }
  }
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > LOG_MAX_BYTES) {
    const cutoff = Date.now() - LOG_KEEP_DAYS * 24 * 3600 * 1000;
    const kept = events.filter((ev) => Date.parse(ev.ts) >= cutoff);
    const tmp = `${logPath()}.${process.pid}.tmp`;
    await fs.writeFile(tmp, kept.map((ev) => JSON.stringify(ev)).join("\n") + "\n", "utf8");
    await fs.rename(tmp, logPath());
    return kept;
  }
  return events;
}
