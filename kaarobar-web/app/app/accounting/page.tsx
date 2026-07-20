"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export default function AccountingPage() {
  const [trialBalance, setTrialBalance] = useState<
    { code: string; name: string; debit: string; credit: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: { code: string; name: string; debit: string; credit: string }[] }>(
      "/reports/trial-balance"
    )
      .then((res) => setTrialBalance(res.data || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accounting</h1>
        <p className="text-[#4A5A52]">
          Chart of accounts, journals, and statements like trial balance and P&L.
        </p>
      </div>
      {error ? <p className="text-sm text-amber-800">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-[#D9D3C7] bg-white">
        <div className="border-b border-[#D9D3C7] bg-[#FAF8F4] px-4 py-3 font-semibold">
          Trial balance
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Debit</th>
              <th className="px-4 py-2">Credit</th>
            </tr>
          </thead>
          <tbody>
            {trialBalance.map((row) => (
              <tr key={row.code} className="border-t border-[#D9D3C7]">
                <td className="px-4 py-2">{row.code}</td>
                <td className="px-4 py-2">{row.name}</td>
                <td className="px-4 py-2">{row.debit}</td>
                <td className="px-4 py-2">{row.credit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
