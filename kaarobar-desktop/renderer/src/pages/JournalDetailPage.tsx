import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { detailRoutes, routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Journal = {
  id: string;
  date: string;
  description: string;
  source_type: string;
  source_id?: string | null;
  is_locked: boolean;
  reversed_entry_id?: string | null;
  branch_id?: string | null;
  lines: {
    account_id: string;
    account_code?: string | null;
    account_name?: string | null;
    debit: string;
    credit: string;
    memo?: string | null;
  }[];
};

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Journal }>(`/journals/${id}`);
      setJournal(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reverse() {
    setBusy(true);
    try {
      await api(`/journals/${id}/reverse`, { method: "POST", body: "{}" });
      toast.success("Reversal posted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reverse failed");
    } finally {
      setBusy(false);
    }
  }

  const totalDr =
    journal?.lines.reduce((s, l) => s + Number(l.debit || 0), 0) ?? 0;
  const totalCr =
    journal?.lines.reduce((s, l) => s + Number(l.credit || 0), 0) ?? 0;

  return (
    <DetailShell
      backHref={routes.accounting}
      backLabel="Back to accounting"
      eyebrow="Journal"
      title={journal?.description || "Journal entry"}
      subtitle={journal ? `${journal.date} · ${journal.source_type}` : undefined}
      status={
        journal
          ? {
              label: journal.reversed_entry_id
                ? "Reversed"
                : journal.is_locked
                  ? "Posted"
                  : "Open",
              tone: journal.reversed_entry_id ? "warning" : "success",
            }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        journal?.is_locked && journal.source_type !== "reversal" && !journal.reversed_entry_id ? (
          <Button loading={busy} variant="outline" onClick={() => void reverse()}>
            Reverse
          </Button>
        ) : null
      }
    >
      {journal ? (
        <>
          <DetailSection title="Entry">
            <DetailFieldGrid
              fields={[
                { label: "Date", value: journal.date },
                { label: "Source", value: journal.source_type },
                { label: "Source id", value: journal.source_id || "—" },
                {
                  label: "Reversal of",
                  value: journal.reversed_entry_id ? (
                    <Link
                      to={detailRoutes.journal(journal.reversed_entry_id)}
                      className="text-brand underline"
                    >
                      View
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "Total debit", value: `Rs ${totalDr.toFixed(2)}` },
                { label: "Total credit", value: `Rs ${totalCr.toFixed(2)}` },
              ]}
            />
          </DetailSection>
          <DetailSection title="Lines">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2">Account</th>
                  <th className="py-2">Memo</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {journal.lines.map((l, idx) => (
                  <tr key={`${l.account_id}-${idx}`} className="border-b border-border/50">
                    <td className="py-2 font-medium text-heading">
                      {l.account_code || l.account_id.slice(0, 8)}
                      {l.account_name ? (
                        <span className="block text-xs font-normal text-body">{l.account_name}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-body">{l.memo || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{l.debit}</td>
                    <td className="py-2 text-right tabular-nums">{l.credit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
