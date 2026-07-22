import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, colors } from "../lib/api";
import BuyerNav from "./BuyerNav";

type Invoice = {
  id: string;
  business_id?: string;
  invoice_number: string;
  balance_due: string;
  status: string;
};

/** Buyer view of `/accounting`. */
export default function BuyerAr() {
  const [balances, setBalances] = useState<{ business_id: string; balance: string }[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await api<{
      data: {
        balances: { business_id: string; balance: string }[];
        invoices: Invoice[];
      };
    }>("/portal/ar");
    setBalances(res.data.balances || []);
    setInvoices(res.data.invoices || []);
  }

  useEffect(() => {
    void load().catch((err) =>
      setMessage(err instanceof Error ? err.message : "Failed to load")
    );
  }, []);

  async function pay(invoice: Invoice) {
    setBusy(true);
    setMessage(null);
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
      setMessage("Payment recorded.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <Text style={styles.title}>Khata balance</Text>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {balances.map((b) => (
        <View key={b.business_id} style={styles.card}>
          <Text style={styles.meta}>
            Store {b.business_id.slice(0, 8)}… · <Text style={styles.strong}>Rs {b.balance}</Text>
          </Text>
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
                  Due Rs {inv.balance_due} · {inv.status}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading, marginBottom: 12 },
  msg: { color: colors.body, marginBottom: 8 },
  empty: { color: colors.body },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  invoice: { fontWeight: "700", color: colors.heading },
  meta: { marginTop: 4, color: colors.body, fontSize: 13 },
  strong: { fontWeight: "800", color: colors.heading },
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
