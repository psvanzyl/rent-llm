/**
 * Admin gate for the operator usage dashboard.
 *
 * An admin is a signed-in user whose email is listed in ADMIN_EMAILS
 * (comma-separated, case-insensitive). Defaults to the owner address so the
 * dashboard works without extra config; set ADMIN_EMAILS in Coolify to add or
 * change operators.
 */
import { verifySession, sessionCookieValue } from "@/lib/auth";
import { getUser } from "@/lib/accounts";

const DEFAULT_ADMINS = [
  "psvanzyl@gmail.com",
  "psvanzyl@laserraptor.eu",
  "psvanzyl@proton.me",
].join(",");

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMINS)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

export type AdminCheck =
  | { kind: "ok"; email: string }
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; email: string };

export async function checkAdmin(req: Request): Promise<AdminCheck> {
  const uid = verifySession(sessionCookieValue(req));
  if (!uid) return { kind: "unauthenticated" };
  const user = await getUser(uid);
  if (!user) return { kind: "unauthenticated" };
  const email = user.email.toLowerCase();
  if (adminEmails().includes(email)) return { kind: "ok", email };
  return { kind: "forbidden", email };
}
