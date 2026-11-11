"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

/**
 * New-password card for /reset-password?token=... (email link target).
 * The token is spent only by the POST — the GET of this page consumes nothing,
 * so a mail-client prefetch cannot burn the link.
 */
function ResetCard() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d?.message || "That did not work. Please try again.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-white";

  if (!token) {
    return <p className="text-sm text-gray-400">This link is incomplete. Request a new reset link from the sign-in page.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <input type="password" value={pw} minLength={8} required autoComplete="new-password"
        placeholder="New password (at least 8 characters)" onChange={(e) => setPw(e.target.value)} className={input} />
      <input type="password" value={pw2} minLength={8} required autoComplete="new-password"
        placeholder="Confirm password" onChange={(e) => setPw2(e.target.value)} className={input} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy}
        className="w-full rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">New password</h1>
      <p className="mt-2 text-gray-400">Choose a new password. You&apos;ll be signed in straight after.</p>
      <div className="mt-8">
        <Suspense fallback={null}>
          <ResetCard />
        </Suspense>
      </div>
    </div>
  );
}
