import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { readAccounts } from "@/lib/accounts";

export interface ApiKeyRecord {
  id: string;
  userId: string;
  /** sha256 of the raw key */
  keyHash: string;
  /** first 8 chars of raw key, for display */
  prefix: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

interface KeyStore {
  keys: Record<string, ApiKeyRecord>;
}

function dataDir(): string {
  return process.env.RENT_DATA_DIR || "/app/data/accounts";
}

async function ensureDir(): Promise<void> {
  const dir = dataDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o775 }).catch(() => {});
  await fs.chmod(dir, 0o775).catch(() => {});
}

function keysPath(): string {
  return path.join(dataDir(), "apikeys.json");
}

async function readStore(): Promise<KeyStore> {
  await ensureDir();
  let raw: string;
  try {
    raw = await fs.readFile(keysPath(), "utf8");
  } catch (e) {
    if ((e as { code?: string })?.code === "ENOENT") return { keys: {} };
    throw e;
  }
  try {
    const parsed = JSON.parse(raw) as KeyStore;
    return { keys: parsed.keys || {} };
  } catch (e) {
    throw new Error(`api key store corrupt: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

async function writeStore(store: KeyStore): Promise<void> {
  await ensureDir();
  const tmp = `${keysPath()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store), "utf8");
  await fs.rename(tmp, keysPath());
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRawKey(): string {
  return `rl_${randomBytes(24).toString("base64url")}`;
}

export async function createApiKey(userId: string, name: string): Promise<{ record: ApiKeyRecord; rawKey: string }> {
  const rawKey = generateRawKey();
  const record: ApiKeyRecord = {
    id: randomBytes(8).toString("hex"),
    userId,
    keyHash: hashKey(rawKey),
    prefix: rawKey.slice(0, 10),
    name: name || "default",
    createdAt: new Date().toISOString(),
  };
  const store = await readStore();
  store.keys[record.id] = record;
  await writeStore(store);
  return { record, rawKey };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  const store = await readStore();
  return Object.values(store.keys).filter((k) => k.userId === userId);
}

export async function findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined> {
  const store = await readStore();
  return Object.values(store.keys).find((k) => k.keyHash === keyHash && !k.revokedAt);
}

export async function validateApiKey(rawKey: string): Promise<ApiKeyRecord | undefined> {
  if (!rawKey) return undefined;
  const rec = await findApiKeyByHash(hashKey(rawKey));
  if (!rec) return undefined;
  // update lastUsedAt
  const store = await readStore();
  if (store.keys[rec.id]) {
    store.keys[rec.id].lastUsedAt = new Date().toISOString();
    await writeStore(store);
  }
  return rec;
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const store = await readStore();
  const rec = store.keys[keyId];
  if (!rec || rec.userId !== userId) return false;
  rec.revokedAt = new Date().toISOString();
  await writeStore(store);
  return true;
}
