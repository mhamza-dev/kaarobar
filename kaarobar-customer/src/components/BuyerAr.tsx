import { useEffect, useMemo, useState } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors, getSession } from "../lib/api";
import { useToast } from "./Toast";
import BuyerNav from "./BuyerNav";
import { BuyerEmptyPanel, BuyerHero } from "./BuyerLayout";
import { BuyerArSkeleton } from "./BuyerSkeletons";
import { t } from "../lib/i18n";

type Invoice = {
  id: string;
  business_id?: string;
  business_name?: string | null;
  invoice_number: string;
  total_amount?: string;
  balance_due: string;
  status: string;
  due_date?: string | null;
};

type Balance = {
  business_id: string;
  business_name?: string | null;
  balance: string;
};

/** Buyer view of `/app/accounting`. */
export default function BuyerAr() {
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const toast = useToast();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [memberships, setMemberships] = useState<
    { business_id: string; business_name?: string | null }[]
  >([]);

  function nameFor(id?: string | null) {
    if (!id) return t("marketplace.store");
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
      toast.success(t("marketplace.paymentRecorded"));
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("marketplace.paymentFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <BuyerNav />
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerArTitle")}
        description={t("pages.buyerArDesc")}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <BuyerArSkeleton />
      ) : (
        <>
          {balances.length === 0 && invoices.length === 0 ? (
            <BuyerEmptyPanel
              title={t("marketplace.emptyArTitle")}
              body={t("marketplace.emptyArBody")}
            />
          ) : null}
          {balances.length > 0 ? (
            <Text style={styles.section}>{t("marketplace.storesWithBalance")}</Text>
          ) : null}
          {balances.map((b) => (
            <View key={b.business_id} style={styles.card}>
              <Text style={styles.biz}>{b.business_name || nameFor(b.business_id)}</Text>
              <Text style={styles.amount}>Rs {b.balance}</Text>
            </View>
          ))}
          {invoices.length > 0 ? (
            <Text style={styles.section}>{t("marketplace.openInvoices")}</Text>
          ) : balances.length > 0 ? (
            <Text style={styles.meta}>{t("marketplace.noOpenInvoices")}</Text>
          ) : null}
          {invoices.map((inv) => (
            <Pressable key={inv.id} style={styles.card} onPress={() => setSelected(inv)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoice}>{inv.invoice_number}</Text>
                  <Text style={styles.meta}>
                    {inv.business_name || nameFor(inv.business_id)} · {t("marketplace.due")} Rs{" "}
                    {inv.balance_due} · {inv.status}
                  </Text>
                  <Text style={[styles.tap, { color: palette.brand }]}>
                    {t("marketplace.viewDetails")} →
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </>
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selected?.invoice_number}</Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                <Text style={{ color: palette.brand, fontWeight: "700" }}>
                  {t("common.close")}
                </Text>
              </Pressable>
            </View>
            {selected ? (
              <>
                <Text style={styles.meta}>
                  {selected.business_name || nameFor(selected.business_id)}
                </Text>
                <Text style={styles.meta}>
                  {t("common.status")} · {selected.status}
                </Text>
                {selected.total_amount ? (
                  <Text style={styles.meta}>
                    {t("common.total")} · Rs {selected.total_amount}
                  </Text>
                ) : null}
                {selected.due_date ? (
                  <Text style={styles.meta}>
                    {t("marketplace.dueDate")} · {String(selected.due_date)}
                  </Text>
                ) : null}
                <Text style={styles.amount}>Rs {selected.balance_due}</Text>
                <Text style={styles.meta}>{t("marketplace.balanceDue")}</Text>
                <Pressable
                  style={[styles.pay, busy && { opacity: 0.5 }]}
                  disabled={busy}
                  onPress={() => void pay(selected)}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.payText}>
                      {t("marketplace.payNow")} · Rs {selected.balance_due}
                    </Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
    error: { color: colors.danger, marginBottom: 8 },
    section: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radiusLg,
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
    tap: { marginTop: 8, fontWeight: "700", fontSize: 13 },
    pay: {
      marginTop: 16,
      backgroundColor: palette.brand,
      borderRadius: colors.radiusLg,
      paddingHorizontal: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    payText: { color: colors.white, fontWeight: "700" },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(15,23,42,0.45)",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 36,
    },
    sheetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.heading, flex: 1 },
  });
}
