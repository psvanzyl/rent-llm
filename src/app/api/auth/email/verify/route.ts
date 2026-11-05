import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createUser, findUserByEmail, normalizeEmail, updateUser } from "@/lib/accounts";
import { consumeEmailToken } from "@/lib/email-tokens";
import {
  authConfigured,
  serverErrorResponse,
  withSessionCookie,
} from "@/lib/auth";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_GET = async (req: Request) => {
  if (!authConfigured()) {
    return NextResponse.json({ error: "auth_unavailable", message: "Sign-in is not configured." }, { status: 503 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const email = await consumeEmailToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_link", req.url));
  }
  try {
    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUser({
        id: randomUUID(),
        email: normalizeEmail(email),
        passwordHash: "email:magic",
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    } else {
      user = (await updateUser(user.id, { lastLoginAt: new Date().toISOString() })) ?? user;
    }
    const base = process.env.APP_URL || `https://${req.headers.get("host")}`;
    const res = NextResponse.redirect(new URL("/dashboard", base));
    return withSessionCookie(res, req, user.id);
  } catch (e) {
    return serverErrorResponse(e, "email-verify");
  }
};

export const GET = jsonRoute("auth-email-verify", { GET: handler_GET });
