import { useCallback, useEffect, useState, useMemo } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useField } from "formik";
import { api, colors, getSession, type Session } from "../lib/api";
import { canAccess, canAccessRoute } from "../lib/rbac";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath } from "../lib/nav";
import { formatDecimal } from "../lib/decimal";
import CustomForm from "../components/ui/CustomForm";
import { FormikTextField } from "../components/ui/FormFields";
import {
  emptyReturnForm,
  returnFormSchema,
  saleLookupFormSchema,
  type ReturnFormValues,
} from "../lib/validations/returns";

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

function QtyField({
  productId,
  styles,
}: {
  productId: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <FormikTextField
      name={`quantities.${productId}`}
      style={[styles.input, { width: 72, marginBottom: 0 }]}
      placeholder="Qty"
      keyboardType="decimal-pad"
      containerStyle={{ width: 72 }}
    />
  );
}

function RefundMethodChips({
  styles,
}: {
  styles: ReturnType<typeof createStyles>;
}) {
  const [field, , helpers] = useField<"cash" | "card" | "wallet">("refund_method");
  return (
    <View style={styles.methodRow}>
      {(["cash", "card", "wallet"] as const).map((m) => (
        <Pressable
          key={m}
          style={[styles.chip, field.value === m && styles.chipActive]}
          onPress={() => void helpers.setValue(m)}
        >
          <Text
            style={[styles.chipText, field.value === m && styles.chipTextActive]}
          >
            {m}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReturnsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [session, setLocal] = useState<Session | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [returnInitial, setReturnInitial] = useState(emptyReturnForm());
  const [pending, setPending] = useState<ReturnRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [tills, setTills] = useState<Till[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canApprove = canAccess(session, "pos_approve");

  const reload = useCallback(async () => {
    try {
      const [p, r, t] = await Promise.all([
        api<{ data: ReturnRow[] }>("/returns/pending"),
        api<{ data: ReturnRow[] }>("/app/returns"),
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
        replacePath(navigation, "/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/returns")) {
        replacePath(navigation, "/app/dashboard");
        return;
      }
      setLocal(s);
      await reload();
    })();
  }, [reload]);

  async function lookupSale(saleId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Sale }>(`/sales/${saleId.trim()}`);
      setSale(res.data);
      const quantities: Record<string, string> = {};
      for (const item of res.data.items || []) quantities[item.product_id] = "";
      setReturnInitial({
        reason: "",
        refund_method: "cash",
        quantities,
      });
    } catch (err) {
      setSale(null);
      setMessage(err instanceof Error ? err.message : "Sale not found");
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn(values: ReturnFormValues) {
    if (!sale || !session?.branch_id) return;
    const items = Object.entries(values.quantities)
      .filter(([, q]) => Number(q) > 0)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    setBusy(true);
    try {
      const res = await api<{ data: ReturnRow }>("/app/returns", {
        method: "POST",
        body: JSON.stringify({
          sale_id: sale.id,
          branch_id: session.branch_id,
          reason: values.reason,
          refund_method: values.refund_method,
          items,
        }),
      });
      setMessage(
        `Return ${res.data.status} · Rs ${formatDecimal(res.data.refund_amount)}`
      );
      setSale(null);
      setReturnInitial(emptyReturnForm());
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
        <ActivityIndicator color={palette.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Returns & tills</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.section}>Create return</Text>
        <CustomForm
          initialValues={{ sale_id: "" }}
          validationSchema={saleLookupFormSchema}
          onSubmit={async (values) => {
            await lookupSale(values.sale_id);
          }}
        >
          {({ handleSubmit }) => (
            <View style={styles.row}>
              <FormikTextField
                name="sale_id"
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Sale ID"
                autoCapitalize="none"
                containerStyle={{ flex: 1 }}
              />
              <Pressable style={styles.btn} onPress={() => handleSubmit()} disabled={busy}>
                <Text style={styles.btnText}>Lookup</Text>
              </Pressable>
            </View>
          )}
        </CustomForm>

        {sale ? (
          <CustomForm
            initialValues={returnInitial}
            validationSchema={returnFormSchema}
            enableReinitialize
            onSubmit={submitReturn}
          >
            {({ handleSubmit }) => (
              <>
                <Text style={styles.body}>
                  Invoice {sale.invoice_number} · Rs {formatDecimal(sale.total_amount)}
                </Text>
                {sale.items.map((item) => (
                  <View key={item.product_id} style={styles.row}>
                    <Text style={[styles.body, { flex: 1 }]}>
                      {item.name} (sold {item.quantity})
                    </Text>
                    <QtyField productId={item.product_id} styles={styles} />
                  </View>
                ))}
                <RefundMethodChips styles={styles} />
                <FormikTextField
                  name="reason"
                  style={styles.input}
                  placeholder="Reason"
                />
                <Pressable style={styles.btn} onPress={() => handleSubmit()} disabled={busy}>
                  <Text style={styles.btnText}>Submit return</Text>
                </Pressable>
              </>
            )}
          </CustomForm>
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
                Rs {formatDecimal(r.refund_amount)} · {r.refund_method}
              </Text>
              <Text style={styles.body}>{r.reason || "No reason"}</Text>
              <View style={styles.row}>
                {canApprove ? (
                  <>
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
                  </>
                ) : (
                  <Text style={styles.body}>Awaiting owner/admin</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Recent returns</Text>
        {returns.slice(0, 15).map((r) => (
          <Text key={r.id} style={styles.body}>
            {r.status} · Rs {formatDecimal(r.refund_amount)} · {r.refund_method}
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

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
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
      backgroundColor: palette.brand,
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
    chipActive: { backgroundColor: palette.brand, borderColor: palette.brand },
    chipText: { color: colors.heading, textTransform: "capitalize" },
    chipTextActive: { color: colors.white, fontWeight: "700" },
    pendingRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 8,
    },
  });
}
