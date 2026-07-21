import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, colors, getSession, type Session } from "../lib/api";
import { canAccessRoute } from "../lib/rbac";

type SaleItem = {
  product_id: string;
  name: string;
  quantity: string;
  line_total: string;
};

type Sale = {
  id: string;
  invoice_number: string;
  total_amount: string;
  items: SaleItem[];
};

type ReturnRow = {
  id: string;
  sale_id: string;
  status: string;
  refund_amount: string;
  refund_method: string;
  reason?: string;
};

type Till = {
  id: string;
  status: string;
  opening_cash: string;
  expected_cash?: string | null;
  closing_cash?: string | null;
  over_short?: string | null;
};

export default function ReturnsScreen() {
  const [session, setLocal] = useState<Session | null>(null);
  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "wallet">("cash");
  const [pending, setPending] = useState<ReturnRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [p, r, t] = await Promise.all([
        api<{ data: ReturnRow[] }>("/returns/pending"),
        api<{ data: ReturnRow[] }>("/returns"),
        api<{ data: Till[] }>("/tills"),
      ]);
      setPending(p.data || []);
      setReturns(r.data || []);
      setTills(t.data || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!canAccessRoute(s, "/returns")) {
        router.replace("/dashboard");
        return;
      }
      setLocal(s);
      await reload();
    })();
  }, [reload]);

  async function lookupSale() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Sale }>(`/sales/${saleId.trim()}`);
      setSale(res.data);
      const initial: Record<string, string> = {};
      for (const item of res.data.items || []) initial[item.product_id] = "";
      setQtyByProduct(initial);
    } catch (err) {
      setSale(null);
      setMessage(err instanceof Error ? err.message : "Sale not found");
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn() {
    if (!sale || !session?.branch_id) return;
    const items = Object.entries(qtyByProduct)
      .filter(([, q]) => Number(q) > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    if (items.length === 0) {
      setMessage("Enter at least one return quantity");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ data: ReturnRow }>("/returns", {
        method: "POST",
        body: JSON.stringify({
          sale_id: sale.id,
          branch_id: session.branch_id,
          reason,
          refund_method: refundMethod,
          items,
        }),
      });
      setMessage(`Return ${res.data.status} · Rs ${res.data.refund_amount}`);
      setSale(null);
      setSaleId("");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Return failed");
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/approve`, { method: "POST", body: "{}" });
      setMessage("Return approved");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    try {
      await api(`/returns/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by manager" }),
      });
      setMessage("Return rejected");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Returns & tills</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.section}>Create return</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={saleId}
            onChangeText={setSaleId}
            placeholder="Sale ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Pressable style={styles.btn} onPress={lookupSale} disabled={busy}>
            <Text style={styles.btnText}>Lookup</Text>
          </Pressable>
        </View>

        {sale ? (
          <>
            <Text style={styles.body}>
              Invoice {sale.invoice_number} · Rs {sale.total_amount}
            </Text>
            {sale.items.map((item) => (
              <View key={item.product_id} style={styles.row}>
                <Text style={[styles.body, { flex: 1 }]}>
                  {item.name} (sold {item.quantity})
                </Text>
                <TextInput
                  style={[styles.input, { width: 72, marginBottom: 0 }]}
                  value={qtyByProduct[item.product_id] || ""}
                  onChangeText={(v) =>
                    setQtyByProduct((prev) => ({ ...prev, [item.product_id]: v }))
                  }
                  placeholder="Qty"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))}
            <View style={styles.methodRow}>
              {(["cash", "card", "wallet"] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.chip, refundMethod === m && styles.chipActive]}
                  onPress={() => setRefundMethod(m)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      refundMethod === m && styles.chipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              placeholderTextColor={colors.muted}
            />
            <Pressable style={styles.btn} onPress={submitReturn} disabled={busy}>
              <Text style={styles.btnText}>Submit return</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Pending approval</Text>
        {pending.length === 0 ? (
          <Text style={styles.body}>No pending returns</Text>
        ) : (
          pending.map((r) => (
            <View key={r.id} style={styles.pendingRow}>
              <Text style={styles.productName}>
                Rs {r.refund_amount} · {r.refund_method}
              </Text>
              <Text style={styles.body}>{r.reason || "No reason"}</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.btn}
                  onPress={() => approve(r.id)}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>Approve</Text>
                </Pressable>
                <Pressable
                  style={styles.btnSecondary}
                  onPress={() => reject(r.id)}
                  disabled={busy}
                >
                  <Text style={styles.btnSecondaryText}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Recent returns</Text>
        {returns.slice(0, 15).map((r) => (
          <Text key={r.id} style={styles.body}>
            {r.status} · Rs {r.refund_amount} · {r.refund_method}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Till history</Text>
        {tills.map((t) => (
          <Text key={t.id} style={styles.body}>
            {t.status} · open {t.opening_cash}
            {t.expected_cash ? ` · expected ${t.expected_cash}` : ""}
            {t.over_short ? ` · Δ ${t.over_short}` : ""}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  container: { flex: 1, padding: 16, backgroundColor: colors.bgPrimary },
  title: { fontSize: 22, fontWeight: "800", color: colors.heading, marginBottom: 8 },
  message: { color: colors.body, marginBottom: 8 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  section: { fontWeight: "700", color: colors.heading, marginBottom: 8 },
  body: { color: colors.body, marginBottom: 6 },
  productName: { fontWeight: "700", color: colors.heading },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.heading,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: colors.white, fontWeight: "700" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btnSecondaryText: { color: colors.heading, fontWeight: "600" },
  methodRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.heading, textTransform: "capitalize" },
  chipTextActive: { color: colors.white, fontWeight: "700" },
  pendingRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 8,
  },
});
