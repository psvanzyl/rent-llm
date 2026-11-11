"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "@/components/GoogleSignInButton";

type Mode = "signin" | "register" | "forgot" | "magic";

/**
 * Sign-in page — the same shape on every Laserraptor property:
 * tabs (Sign in | Create account), email + password, forgot-password link,
 * primary button, "or" divider, Google button, and (here only) the email
 * sign-in link as an extra option below.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code === "invalid_or_expired_link") {
      setError("That sign-in link is invalid or has expired. Enter your email again to get a new link.");
    } else if (code) {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

  async function handleCredential(credential: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Sign-in failed");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const url = mode === "forgot" ? "/api/auth/forgot-password" : mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "forgot" ? { email } : { email, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.message || d?.error || "That did not work. Please try again.");
        return;
      }
      if (mode === "forgot") {
        // Deliberate non-disclosure: same notice whether or not the address has an account.
        setNotice("If an account exists for this email, a reset link is on its way. Check your inbox.");
        setMode("signin");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || data?.error || "Could not send sign-in link");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-white";
  const primary = "w-full rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50";
  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 font-medium transition ${active ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`;

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">{mode === "register" ? "Create your account" : "Sign in"}</h1>
      <p className="mt-2 text-gray-400">Use your email and password, Google, or a sign-in link.</p>

      <div className="mt-8">
        <div className="flex rounded-lg border border-gray-700 p-1 text-sm">
          <button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className={tab(mode === "signin" || mode === "forgot" || mode === "magic")}>
            Sign in
          </button>
          <button type="button" onClick={() => { setMode("register"); setError(null); setNotice(null); }} className={tab(mode === "register")}>
            Create account
          </button>
        </div>

        <div className="mt-6 space-y-3 text-left">
          {(mode === "signin" || mode === "register" || mode === "forgot") && (
            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className={input}
              />
              {mode !== "forgot" && (
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "at least 8 characters" : "your password"}
                    minLength={8}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                    className={input}
                  />
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}
                      className="mt-2 text-[12px] text-gray-400 underline hover:text-white"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading} className={primary}>
                {loading ? "Working…" : mode === "forgot" ? "Send reset link" : mode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>
          )}

          {mode !== "magic" ? (
            <>
              <div className="my-6 text-gray-500">or</div>
              <div className="flex justify-center">
                {loading ? <p className="text-gray-400">Working…</p> : <GoogleSignInButton onSuccess={handleCredential} />}
              </div>
              <button
                type="button"
                onClick={() => { setMode("magic"); setError(null); setNotice(null); setSent(false); }}
                className="block w-full text-center text-[12px] text-gray-400 underline hover:text-white"
              >
                Email me a one-time sign-in link instead
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="my-2 text-gray-500">one-time sign-in link</div>
              {sent ? (
                <p className="text-sm text-green-400">Check your inbox for a sign-in link.</p>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={input}
                  />
                  <button type="submit" disabled={loading} className={primary}>
                    Send sign-in link
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="block w-full text-center text-[12px] text-gray-400 underline hover:text-white"
              >
                Back to password sign-in
              </button>
            </div>
          )}

          {notice && <p className="text-sm text-green-400">{notice}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
