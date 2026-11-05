import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { findUserByEmail, normalizeEmail } from "@/lib/accounts";
import { createEmailToken } from "@/lib/email-tokens";
import { sendMagicLink, emailConfigured } from "@/lib/email";
import {
  authConfigured,
  clientIp,
  isValidEmail,
  originAllowed,
  rateLimit,
  serverErrorResponse,
} from "@/lib/auth";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const handler_POST = async (req: Request) => {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  if (!authConfigured()) {
    return NextResponse.json({ error: "auth_unavailable", message: "Sign-in is not configured." }, { status: 503 });
  }

  const rl = rateLimit(`emailreq:${clientIp(req)}`, 10, 900_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many attempts — try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { email?: unknown };
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email address." }, { status: 400 });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "email_unavailable", message: "Email sign-in is not configured on this server yet." },
      { status: 503 },
    );
  }

  try {
    const normalized = normalizeEmail(email);
    const token = await createEmailToken(normalized);
    const base = process.env.APP_URL || `https://${req.headers.get("host")}`;
    const link = `${base.replace(/\/$/, "")}/api/auth/email/verify?token=${token}`;
    await sendMagicLink(normalized, link);
    // Do not leak whether the account exists.
    return NextResponse.json({ ok: true, message: "Check your inbox for a sign-in link." });
  } catch (e) {
    return serverErrorResponse(e, "email-request");
  }
};

export const POST = jsonRoute("auth-email-request", { POST: handler_POST });
