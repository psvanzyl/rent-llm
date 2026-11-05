import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

interface TokenRecord {
  token: string;
  email: string;
  expiresAt: string;
  used: boolean;
}

interface TokenStore {
  tokens: Record<string, TokenRecord>;
}

const EMPTY: TokenStore = { tokens: {} };
let chain: Promise<void> = Promise.resolve();

function dataDir(): string {
  return process.env.RENT_DATA_DIR || "/app/data/accounts";
}

function tokensPath(): string {
  return path.join(dataDir(), "email-tokens.json");
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true, mode: 0o775 }).catch(() => {});
}

async function readStore(): Promise<TokenStore> {
  await ensureDir();
  let raw: string;
  try {
    raw = await fs.readFile(tokensPath(), "utf8");
  } catch (e) {
    if ((e as { code?: string })?.code === "ENOENT") return { tokens: {} };
    throw e;
  }
  try {
    const parsed = JSON.parse(raw) as TokenStore;
    return { tokens: parsed.tokens || {} };
  } catch {
    return { ...EMPTY };
  }
}

async function writeStore(store: TokenStore): Promise<void> {
  await ensureDir();
  const tmp = `${tokensPath()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store), "utf8");
  await fs.rename(tmp, tokensPath());
}

function prune(store: TokenStore): TokenStore {
  const now = Date.now();
  const tokens: Record<string, TokenRecord> = {};
  for (const [k, v] of Object.entries(store.tokens)) {
    if (!v.used && new Date(v.expiresAt).getTime() > now) tokens[k] = v;
  }
  return { tokens };
}

export async function createEmailToken(email: string, ttlMinutes = 15): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const prev = chain;
  const done = prev.then(async () => {
    const store = prune(await readStore());
    store.tokens[token] = { token, email: email.trim().toLowerCase(), expiresAt, used: false };
    await writeStore(store);
    return token;
  });
  chain = done.then(() => undefined, () => undefined);
  return done;
}

export async function consumeEmailToken(token: string): Promise<string | null> {
  if (!token || token.length < 16) return null;
  const prev = chain;
  const done = prev.then(async () => {
    const store = await readStore();
    const rec = store.tokens[token];
    if (!rec || rec.used) return null;
    if (new Date(rec.expiresAt).getTime() <= Date.now()) return null;
    rec.used = true;
    store.tokens[token] = rec;
    await writeStore(store);
    return rec.email;
  });
  chain = done.then(() => undefined, () => undefined);
  return done;
}
