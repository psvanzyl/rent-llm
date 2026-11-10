"use client";

/**
 * Account settings — modelled on the Realty /konto page.
 *
 * Three sections behind a sidebar: Overview, Account details (saved billing
 * address), and Billing & invoices (received invoices, lazily backfilled from
 * Mollie by /api/invoices).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, User, Receipt } from "lucide-react";

type Section = "overview" | "details" | "invoices";

interface AccountInfo {
  company?: string;
  contactName?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  vatId?: string;
}

interface Me {
  user: { email: string; name?: string; createdAt: string };
  accountInfo: AccountInfo | null;
  plan: { active: boolean; tier: string | null; until: string | null };
  invoiceCount: number;
  totalPaidCents: number;
}

interface Invoice {
  id: string;
  number: string;
  at: string;
  amountCents: number;
  method: string;
  plan: string;
  description?: string;
}

const COUNTRIES: { code: string; label: string }[] = [
  { code: "", label: "— select —" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "GB", label: "United Kingdom" },
  { code: "IT", label: "Italy" },
  { code: "ES", label: "Spain" },
  { code: "PT", label: "Portugal" },
  { code: "IE", label: "Ireland" },
  { code: "LU", label: "Luxembourg" },
  { code: "AT", label: "Austria" },
  { code: "CH", label: "Switzerland" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "CZ", label: "Czechia" },
  { code: "HU", label: "Hungary" },
  { code: "RO", label: "Romania" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
];

const eur = (cents: number) =>
  (cents / 100).toLocaleString("en-IE", { style: "currency", currency: "EUR" });

const inputCls =
  "w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none";

export default function AccountPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [me, setMe] = useState<Me | null>(null);
  const [info, setInfo] = useState<AccountInfo>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const me = await fetch("/api/account");
    if (me.status === 401) { router.push("/login"); return; }
    const md: Me = await me.json();
    setMe(md);
    setInfo(md.accountInfo || {});
    try {
      const iv = await fetch("/api/invoices");
      if (iv.ok) {
        const d = await iv.json();
        setInvoices(d.invoices || []);
        setTotalCents(d.totalCents || 0);
      }
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function saveDetails() {
    setSaving(true);
    setSavedMsg(null);
    setSaveErr(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedMsg("Account details saved.");
        setMe((m) => (m ? { ...m, accountInfo: data.accountInfo } : m));
      } else {
        setSaveErr(data?.message || data?.error || "Could not save. Please try again.");
      }
    } catch {
      setSaveErr("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const nav: { id: Section; label: string; icon: typeof User }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "details", label: "Account details", icon: User },
    { id: "invoices", label: "Billing & invoices", icon: Receipt },
  ];

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-20 text-gray-400">Loading…</div>;
  }
  if (!me) return null;

  const field = (key: keyof AccountInfo, label: string, placeholder: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-400">{label}</span>
      <input
        className={inputCls}
        value={info[key] || ""}
        placeholder={placeholder}
        onChange={(e) => setInfo({ ...info, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold">Account</h1>
      <p className="mt-1 text-sm text-gray-400">{me.user.email}</p>

      <div className="mt-8 flex flex-col gap-6 md:flex-row">
        {/* sidebar — 2-column grid on mobile so nothing gets cut */}
        <nav className="grid grid-cols-3 gap-2 md:flex md:w-52 md:flex-col md:self-start">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                section === n.id
                  ? "bg-amber-500/15 font-medium text-amber-300"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <n.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {section === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <p className="text-xs uppercase text-gray-500">Status</p>
                  <p className="mt-1 text-lg font-semibold">
                    {me.plan.active ? (
                      <span className="text-green-400">Active — {me.plan.tier}</span>
                    ) : (
                      <span className="text-gray-300">No active subscription</span>
                    )}
                  </p>
                  {me.plan.until && (
                    <p className="mt-1 text-sm text-gray-400">
                      Access until {new Date(me.plan.until).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <p className="text-xs uppercase text-gray-500">Total paid</p>
                  <p className="mt-1 text-lg font-semibold text-amber-300">{eur(totalCents)}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <p className="text-xs uppercase text-gray-500">Member since</p>
                  <p className="mt-1 text-lg font-semibold">
                    {new Date(me.user.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <p className="text-xs uppercase text-gray-500">Billing address</p>
                  {me.accountInfo && (me.accountInfo.street || me.accountInfo.company) ? (
                    <p className="mt-1 text-sm text-gray-300">
                      {[me.accountInfo.company, me.accountInfo.street, me.accountInfo.zip && `${me.accountInfo.zip} ${me.accountInfo.city || ""}`.trim(), me.accountInfo.country].filter(Boolean).join(" · ")}
                    </p>
                  ) : (
                    <button onClick={() => setSection("details")} className="mt-1 text-sm text-amber-400 hover:underline">
                      Add your address →
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Manage API keys and your plan on the <a href="/dashboard" className="text-amber-400 hover:underline">dashboard</a>.
              </p>
            </div>
          )}

          {section === "details" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
              <h2 className="text-lg font-semibold">Account details</h2>
              <p className="mt-1 text-sm text-gray-400">
                Your billing address. We use it on your invoices.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {field("company", "Company (optional)", "Company name")}
                {field("contactName", "Contact name", "Full name")}
                <div className="sm:col-span-2">{field("street", "Street and house number", "Street, number")}</div>
                {field("zip", "Postal code", "1234 AB")}
                {field("city", "City", "City")}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-400">Country</span>
                  <select
                    className={inputCls}
                    value={info.country || ""}
                    onChange={(e) => setInfo({ ...info, country: e.target.value })}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </label>
                {field("vatId", "VAT number (optional)", "NL001234567B01")}
              </div>
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={saveDetails}
                  disabled={saving}
                  className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save account details"}
                </button>
                {savedMsg && <span className="text-sm text-green-400">{savedMsg}</span>}
                {saveErr && <span className="text-sm text-red-400">{saveErr}</span>}
              </div>
            </div>
          )}

          {section === "invoices" && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-5">
              <h2 className="text-lg font-semibold">Received invoices</h2>
              {invoices.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">
                  No payments yet. Invoices appear here after each successful payment.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-3 py-2 whitespace-nowrap">Invoice</th>
                        <th className="px-3 py-2 whitespace-nowrap">Date</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 whitespace-nowrap">Method</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="px-3 py-2 font-mono text-xs text-gray-300">{inv.number}</td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-400">
                            {new Date(inv.at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                          </td>
                          <td className="px-3 py-2.5 pr-6 text-gray-200">
                            {inv.description || `Broomy — ${inv.plan}`}
                            <div className="font-mono text-[0.65rem] leading-tight text-gray-400">{inv.id}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-300 capitalize">{inv.method}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-mono text-gray-100">{eur(inv.amountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700">
                        <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase text-gray-400">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono font-semibold text-amber-300">{eur(totalCents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500">
                Need a plan? Subscribe or extend on the <a href="/dashboard" className="text-amber-400 hover:underline">dashboard</a>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
