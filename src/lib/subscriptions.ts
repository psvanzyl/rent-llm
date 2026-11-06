import type { UserRecord } from "@/lib/accounts";

export function hasActiveSubscription(user: UserRecord | undefined | null): boolean {
  if (!user?.subscriptionUntil) return false;
  return new Date(user.subscriptionUntil).getTime() > Date.now();
}

export function tierConcurrent(user: UserRecord | undefined | null): number {
  if (!hasActiveSubscription(user)) return 0;
  return user?.subscriptionTier === "pro" ? 3 : 1;
}

export function subscriptionTier(user: UserRecord | undefined | null): "basic" | "pro" | null {
  if (!hasActiveSubscription(user)) return null;
  return (user?.subscriptionTier as "basic" | "pro") || "basic";
}
