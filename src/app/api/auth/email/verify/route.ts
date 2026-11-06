import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createUser, findUserByEmail, normalizeEmail, updateUser } from "@/lib/accounts";
import { consumeEmailToken, peekEmailToken } from "@/lib/email-tokens";
import {
  authConfigured,
  originAllowed,
  serverErrorResponse,
  withSessionCookie,
} from "@/lib/auth";
import { jsonRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appBase(req: Request): string {
  return process.env.APP_URL || `https://${req.headers.get("host") || "broomy.laserraptor.eu"}`;
}

const GET_handler = async (req: Request) => {
  if (!authConfigured()) {
    return NextResponse.json({ error: "auth_unavailable", message: "Sign-in is not configured." }, { status: 503 });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token || token.length < 16) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_link", appBase(req)));
  }
  // Validate up-front (without consuming) so a dead link bounces to /login
  // immediately instead of rendering a button that cannot work. The token is
  // only consumed on POST, so email-client pre-fetch (GET) cannot burn it.
  const peekedEmail = await peekEmailToken(token);
  if (!peekedEmail) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_link", appBase(req)));
  }
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in to Broomy</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#16161d;border:1px solid #2a2a35;border-radius:12px;padding:2rem;max-width:420px;text-align:center}
button{margin-top:1.25rem;background:#f59e0b;color:#000;border:0;border-radius:8px;padding:.75rem 1.5rem;font-weight:600;cursor:pointer;font-size:1rem}
button:hover{background:#fbbf24}
p{color:#9ca3af;font-size:.9rem}
</style>
</head>
<body>
<div class="card">
<h1>Sign in to Broomy</h1>
<p>Signing in as <strong>${escapeHtml(peekedEmail)}</strong>. This link is single-use.</p>
<form method="POST" action="/api/auth/email/verify">
<input type="hidden" name="token" value="${escapeHtml(token)}" />
<button type="submit" onclick="this.disabled=true;this.form.submit();return false">Sign in</button>
</form>
</div>
</body>
</html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
};

const POST_handler = async (req: Request) => {
  if (!authConfigured()) {
    return NextResponse.json({ error: "auth_unavailable", message: "Sign-in is not configured." }, { status: 503 });
  }
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }
  let token = "";
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    token = ((await req.json().catch(() => ({}))) as { token?: string })?.token || "";
  } else {
    const form = await req.formData().catch(() => null);
    token = (form?.get("token") as string) || new URLSearchParams(await req.text()).get("token") || "";
  }
  const email = await consumeEmailToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_link", appBase(req)));
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
    const base = appBase(req);
    const res = NextResponse.redirect(new URL("/dashboard", base));
    return withSessionCookie(res, req, user.id);
  } catch (e) {
    return serverErrorResponse(e, "email-verify");
  }
};

export const GET = GET_handler;
export const POST = POST_handler;
