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

export async function recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void> {
  const store = await readStore();
  const cur = store.usage[keyId] || { keyId, requests: 0, promptTokens: 0, completionTokens: 0 };
  cur.requests += 1;
  cur.promptTokens += promptTokens || 0;
  cur.completionTokens += completionTokens || 0;
  cur.lastUsedAt = new Date().toISOString();
  store.usage[keyId] = cur;
  await writeStore(store);
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
