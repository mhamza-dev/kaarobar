import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, colors, getSession } from "../lib/api";
import { useToast } from "./Toast";
import BuyerNav from "./BuyerNav";

type Invoice = {
  id: string;
  business_id?: string;
  business_name?: string | null;
  invoice_number: string;
  balance_due: string;
  status: string;
};

type Balance = {
  business_id: string;
  business_name?: string | null;
  balance: string;
};

/** Buyer view of `/app/accounting`. */
export default function BuyerAr() {
  const toast = useToast();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<
    { business_id: string; business_name?: string | null }[]
  >([]);

  function nameFor(id?: string | null) {
    if (!id) return "Store";
    const fromBal = balances.find((b) => b.business_id === id)?.business_name;
    if (fromBal) return fromBal;
    return (
      memberships.find((m) => m.business_id === id)?.business_name ||
      `${id.slice(0, 8)}…`
    );
  }

  async function load() {
    const session = await getSession();
    setMemberships(session?.buyer_memberships || []);
    const res = await api<{
      data: {
        balances: Balance[];
        invoices: Invoice[];
      };
    }>("/portal/ar");
    setBalances(res.data.balances || []);
    setInvoices(res.data.invoices || []);
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function pay(invoice: Invoice) {
    setBusy(true);
    setError(null);
    try {
      await api("/portal/ar/pay", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: invoice.balance_due,
          method: "card",
          business_id: invoice.business_id,
        }),
      });
      toast.success("Payment recorded");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Khata balance</Text>
      <Text style={styles.hint}>View store credit and pay open invoices.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />
      ) : (
        <>
          {balances.map((b) => (
            <View key={b.business_id} style={styles.card}>
              <Text style={styles.biz}>{b.business_name || nameFor(b.business_id)}</Text>
              <Text style={styles.amount}>Rs {b.balance}</Text>
            </View>
          ))}
          {invoices.length === 0 ? (
            <Text style={styles.empty}>No open invoices.</Text>
          ) : (
            invoices.map((inv) => (
              <View key={inv.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoice}>{inv.invoice_number}</Text>
                    <Text style={styles.meta}>
                      {inv.business_name || nameFor(inv.business_id)} · Due Rs {inv.balance_due} ·{" "}
                      {inv.status}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.pay, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={() => void pay(inv)}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.payText}>Pay</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading },
  hint: { color: colors.body, marginTop: 4, marginBottom: 14 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.body, marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  biz: { fontWeight: "700", color: colors.heading },
  amount: { marginTop: 6, fontSize: 22, fontWeight: "800", color: colors.heading },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  invoice: { fontWeight: "800", color: colors.heading },
  meta: { marginTop: 4, color: colors.body, fontSize: 13 },
  pay: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: "center",
  },
  payText: { color: colors.white, fontWeight: "700" },
});
