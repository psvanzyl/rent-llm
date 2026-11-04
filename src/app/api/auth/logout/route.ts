import { NextResponse } from "next/server";
import { withClearedSessionCookie } from "@/lib/auth";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_POST = async (req: Request) => {
  const res = NextResponse.json({ ok: true });
  return withClearedSessionCookie(res);
};

export const POST = jsonRoute("auth-logout", { POST: handler_POST });
