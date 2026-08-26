"use client";

import { FormEvent, useMemo, useState } from "react";
import type { DirectDebitStatus, ProviderDefinition, UserAccount } from "@/lib/domain/types";

function poundsToMinor(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function AccountsClient({
  initialAccounts,
  providers,
}: {
  initialAccounts: UserAccount[];
  providers: ProviderDefinition[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [nickname, setNickname] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [balance, setBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [directDebitStatus, setDirectDebitStatus] = useState<DirectDebitStatus>("unknown");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === providerId) ?? null,
    [providerId, providers],
  );

  async function addAccount(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      setStatus("Last four digits must be exactly four numbers.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: providerId || null,
          accountType: "credit_card",
          nickname: nickname.trim() || null,
          lastFour: lastFour || null,
          balanceMinor: poundsToMinor(balance),
          creditLimitMinor: poundsToMinor(creditLimit),
          directDebitStatus,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? "We could not add this account.");
        return;
      }

      const account = data.account as UserAccount;
      if (!account.providerName && selectedProvider) account.providerName = selectedProvider.displayName;
      setAccounts((current) => [...current, account]);
      setNickname("");
      setLastFour("");
      setBalance("");
      setCreditLimit("");
      setDirectDebitStatus("unknown");
      setStatus("Account added.");
    } catch {
      setStatus("We could not add this account. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(accountId: string) {
    setStatus("");
    try {
      const response = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      if (!response.ok) {
        setStatus("We could not remove this account.");
        return;
      }
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      setStatus("Account removed.");
    } catch {
      setStatus("We could not remove this account. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Add a credit account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add only enough information for Credit Quest to target the right mission. Never enter your full card number or banking password.
        </p>

        <form onSubmit={addAccount} className="mt-5 grid gap-4">
          <label className="text-sm font-bold text-slate-700">
            Provider
            <select
              aria-label="Provider"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
            >
              <option value="">Other / not listed</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.displayName}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-bold text-slate-700">
            Account nickname
            <input
              aria-label="Account nickname"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={nickname}
              maxLength={80}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="e.g. Everyday card"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
            Last four digits (optional)
            <input
              aria-label="Last four digits (optional)"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={lastFour}
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              Current balance (£, optional)
              <input
                aria-label="Current balance in pounds"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={balance}
                inputMode="decimal"
                onChange={(event) => setBalance(event.target.value)}
                placeholder="620"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Credit limit (£, optional)
              <input
                aria-label="Credit limit in pounds"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                value={creditLimit}
                inputMode="decimal"
                onChange={(event) => setCreditLimit(event.target.value)}
                placeholder="1000"
              />
            </label>
          </div>

          <label className="text-sm font-bold text-slate-700">
            Direct debit status
            <select
              aria-label="Direct debit status"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              value={directDebitStatus}
              onChange={(event) => setDirectDebitStatus(event.target.value as DirectDebitStatus)}
            >
              <option value="unknown">I don&apos;t know</option>
              <option value="yes">Set up</option>
              <option value="no">Not set up</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add account"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-black">Your accounts</h2>
        {accounts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No accounts added yet.</p>
        ) : accounts.map((account) => (
          <article key={account.id} className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black">{account.nickname || account.providerName || "Credit account"}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {account.providerName ?? "Provider not listed"}
                  {account.lastFour ? ` • ending ${account.lastFour}` : ""}
                </p>
                <p className="mt-2 text-sm text-slate-600">Direct debit: {account.directDebitStatus === "yes" ? "set up" : account.directDebitStatus === "no" ? "not set up" : "unknown"}</p>
              </div>
              <button
                type="button"
                onClick={() => removeAccount(account.id)}
                className="text-sm font-bold text-rose-700"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>

      {status && <p role="status" className="rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-700">{status}</p>}
    </div>
  );
}
