import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/apikeys";
import { getUsageForKeys } from "@/lib/usage";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_GET = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const keys = await listApiKeys(user.id);
  const usage = await getUsageForKeys(keys.map((k) => k.id));
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
      usage: usage[k.id],
    })),
  });
};

const handler_POST = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { name?: unknown } = {};
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    body = {};
  }
  const name = String(body.name ?? "default").slice(0, 64);
  const { record, rawKey } = await createApiKey(user.id, name);
  return NextResponse.json({
    key: rawKey,
    record: { id: record.id, prefix: record.prefix, name: record.name, createdAt: record.createdAt },
  });
};

const handler_DELETE = async (req: Request) => {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const ok = await revokeApiKey(user.id, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
};

export const GET = jsonRoute("keys", { GET: handler_GET });
export const POST = jsonRoute("keys", { POST: handler_POST });
export const DELETE = jsonRoute("keys", { DELETE: handler_DELETE });
