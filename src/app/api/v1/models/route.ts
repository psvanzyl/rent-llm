import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";
import { getUser } from "@/lib/accounts";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

interface BackendConfig {
  url: string;
  key: string;
}

const BACKENDS: { id: string; config: BackendConfig; models: { id: string; context_length: number }[] }[] = [
  {
    id: "strata",
    config: {
      url: process.env.LLM_BACKEND_URL || "http://192.168.178.16:8086/v1",
      key: process.env.LLM_BACKEND_KEY || "local-no-auth",
    },
    models: [{ id: "qwen3.8-flash-next-ud-q4_k_xl", context_length: 262144 }],
  },
  {
    id: "bonsai",
    config: {
      url: process.env.LLM_BACKEND2_URL || "http://192.168.178.10:8087/v1",
      key: process.env.LLM_BACKEND2_KEY || "",
    },
    models: [{ id: "bonsai-2-27b", context_length: 65536 }],
  },
];

export function backendForModel(model: string): BackendConfig {
  if (model.startsWith("bonsai")) {
    return BACKENDS[1].config;
  }
  return BACKENDS[0].config;
}

const handler_GET = async (req: Request) => {
  const auth = req.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const rec = await validateApiKey(raw);
  if (!rec) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const owner = await getUser(rec.userId);
  if (!hasActiveSubscription(owner)) {
    return NextResponse.json({ error: "subscription_expired", message: "Subscription expired or inactive." }, { status: 402 });
  }

  const allModels: { id: string; object: string; owned_by: string }[] = [];
  for (const b of BACKENDS) {
    if (b.id === "bonsai" && !b.config.key) continue;
    try {
      const res = await fetch(b.config.url + "/models", {
        headers: { Authorization: "Bearer " + b.config.key },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const live = Array.isArray(data?.data) ? data.data : [];
        if (live.length > 0) {
          for (const m of live) {
            allModels.push({ id: m.id || b.models[0].id, object: "model", owned_by: b.id });
          }
          continue;
        }
      }
    } catch {
      // fall through to static
    }
    for (const m of b.models) {
      allModels.push({ id: m.id, object: "model", owned_by: b.id });
    }
  }

  return NextResponse.json({ object: "list", data: allModels });
};

export const GET = jsonRoute("v1-models", { GET: handler_GET });
