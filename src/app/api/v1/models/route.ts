import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const BACKEND = process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1";
const BACKEND_KEY = process.env.LLM_BACKEND_KEY || "local-no-auth";

const handler_GET = async (req: Request) => {
  const auth = req.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const rec = await validateApiKey(raw);
  if (!rec) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  try {
    const res = await fetch(`${BACKEND}/models`, {
      headers: { Authorization: `Bearer ${BACKEND_KEY}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 502 });
  }
};

export const GET = jsonRoute("v1-models", { GET: handler_GET });
