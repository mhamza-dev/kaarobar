import {useCallback, useEffect, useState, useMemo } from "react";
import { useBrandPalette } from "../lib/BrandThemeContext";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useField } from "formik";
import { api, apiAllPages, colors, getSession, type Session } from "../lib/api";
import Switch from "../components/ui/Switch";
import { canAccess, canAccessRoute } from "../lib/rbac";
import { t } from "../lib/i18n";
import {
  type Customer,
  type CustomerForm,
  customerPayload,
  customerToForm,
  emptyCustomerForm,
} from "../lib/customers";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import ListToolbar, { emptyStaffFilters } from "../components/ListToolbar";
import { applyListingFilters } from "../lib/listingFilters";
import { formatDecimal } from "../lib/decimal";
import ScreenCard from "../components/screen/ScreenCard";
import CustomerFormFields from "../features/customers/components/CustomerFormFields";
import CustomForm from "../components/ui/CustomForm";
import { customerFormSchema } from "../lib/validations/customers";

type LedgerEntry = {
  kind: string;
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
};

function CreditEnabledSwitch({ label }: { label: string }) {
  const [field, , helpers] = useField<boolean>("credit_enabled");
  return (
    <View style={{ marginBottom: 8 }}>
      <Switch
        checked={Boolean(field.value)}
        onChange={(v) => void helpers.setValue(v)}
        label={label}
      />
    </View>
  );
}

export default function CustomersScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const palette = useBrandPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filters, setFilters] = useState(emptyStaffFilters());
  const [formInitial, setFormInitial] = useState<CustomerForm>(emptyCustomerForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [ledger, setLedger] = useState<{
    customer: Customer;
    balance: string;
    entries: LedgerEntry[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loyaltyDelta, setLoyaltyDelta] = useState("10");

  const load = useCallback(async () => {
    try {
      const data = await apiAllPages<Customer>("/customers");
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        replacePath(navigation, "/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/customers")) {
        replacePath(navigation, "/app/pos");
        return;
      }
      setSession(s);
      await load();
    })();
  }, [load]);

  const filtered = applyListingFilters(customers, filters, {
    searchText: (c) => `${c.name} ${c.phone || ""} ${c.company_name || ""}`,
  });

  async function save(values: CustomerForm) {
    setBusy(true);
    setMessage(null);
    try {
      const body = customerPayload(values);
      if (editingId) {
        await api(`/customers/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/customers", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      setEditingId(null);
      setFormInitial(emptyCustomerForm());
      setMessage("Saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleKhata(c: Customer) {
    try {
      await api(`/customers/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ credit_enabled: !c.credit_enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function openLedger(c: Customer) {
    try {
      const res = await api<{
        data: { customer: Customer; balance: string; entries: LedgerEntry[] };
      }>(`/customers/${c.id}/ledger`);
      setLedger({
        customer: res.data.customer,
        balance: res.data.balance,
        entries: res.data.entries || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ledger failed");
    }
  }

  async function adjustPoints(c: Customer) {
    try {
      await api(`/customers/${c.id}/loyalty`, {
        method: "POST",
        body: JSON.stringify({ delta: Number(loyaltyDelta), reason: "Mobile adjust" }),
      });
      setMessage("Points updated");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Points failed");
    }
  }

  if (!session) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{t("pages.customersTitle")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        style={styles.primaryBtn}
        onPress={() => {
          setEditingId(null);
          setFormInitial(emptyCustomerForm());
          setShowForm(true);
        }}
      >
        <Text style={styles.primaryBtnText}>{t("customers.add")}</Text>
      </Pressable>

      {showForm ? (
        <ScreenCard
          style={styles.card}
          title={editingId ? t("customers.edit") : t("customers.add")}
          titleStyle={styles.cardTitle}
        >
          <CustomForm
            initialValues={formInitial}
            validationSchema={customerFormSchema}
            enableReinitialize
            onSubmit={async (values) => {
              const next = { ...values };
              if (next.credit_limit.trim()) {
                next.credit_limit = formatDecimal(next.credit_limit);
              }
              await save(next);
            }}
          >
            {({ handleSubmit }) => (
              <>
                <CustomerFormFields inputStyle={styles.input} />
                <CreditEnabledSwitch label={t("customers.khata")} />
                <Pressable
                  style={styles.primaryBtn}
                  disabled={busy}
                  onPress={() => handleSubmit()}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy ? t("common.loading") : t("common.save")}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setShowForm(false)}>
                  <Text style={styles.link}>{t("common.cancel")}</Text>
                </Pressable>
              </>
            )}
          </CustomForm>
        </ScreenCard>
      ) : null}

      <View style={styles.listShell}>
        <ListToolbar
          value={filters}
          onChange={setFilters}
          searchPlaceholder={t("customers.search")}
          embedded
        />

        {filtered.map((c) => (
          <View key={c.id} style={styles.rowCard}>
            <Text style={styles.cardTitle}>{c.name}</Text>
            <Text style={styles.cardBody}>
              {c.phone || "—"} · {c.company_name || "no company"} · pts {c.loyalty_points ?? 0}
            </Text>
            <Text style={styles.cardBody}>
              {t("customers.khata")} {c.credit_enabled ? t("customers.khataOn") : t("customers.khataOff")} · Balance {c.balance || "0"}
            </Text>
            <View style={styles.rowWrap}>
              {c.portal_linked ? (
                <Text style={styles.portalBadge}>Portal signed up</Text>
              ) : (
                <Pressable
                  style={styles.chip}
                  onPress={() => {
                    setEditingId(c.id);
                    setFormInitial(customerToForm(c));
                    setShowForm(true);
                  }}
                >
                  <Text style={styles.chipText}>{t("common.edit")}</Text>
                </Pressable>
              )}
              <Pressable style={styles.chip} onPress={() => void toggleKhata(c)}>
                <Text style={styles.chipText}>{c.credit_enabled ? t("customers.disableKhata") : t("customers.enableKhata")}</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => void openLedger(c)}>
                <Text style={styles.chipText}>{t("customers.ledger")}</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => void adjustPoints(c)}>
                <Text style={styles.chipText}>{t("customers.points")}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder={t("customers.delta")}
              placeholderTextColor={colors.muted}
              value={loyaltyDelta}
              onChangeText={setLoyaltyDelta}
              keyboardType="numeric"
            />
          </View>
        ))}
      </View>

      {ledger ? (
        <ScreenCard
          style={styles.card}
          title={`${ledger.customer.name} ledger`}
          titleStyle={styles.cardTitle}
        >
          <Text style={styles.cardBody}>
            Balance Rs {formatDecimal(ledger.balance)}
          </Text>
          {ledger.entries.map((e, i) => (
            <Text key={`${e.reference}-${i}`} style={styles.cardBody}>
              {e.date} · {e.kind} · {e.reference} · Dr {formatDecimal(e.debit)} Cr{" "}
              {formatDecimal(e.credit)}
            </Text>
          ))}
          <Pressable onPress={() => setLedger(null)}>
            <Text style={styles.link}>{t("common.close")}</Text>
          </Pressable>
        </ScreenCard>
      ) : null}

      {canAccess(session, "marketing") ? (
        <Pressable style={styles.primaryBtn} onPress={() => pushPath(navigation, "/app/marketing")}>
          <Text style={styles.primaryBtnText}>{t("nav.marketing")}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function createStyles(palette: import("../lib/brandTheme").BrandPalette) {
  return StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.bgPrimary },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading, marginBottom: 12 },
  error: { color: colors.danger, marginBottom: 8 },
  message: { color: colors.body, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    color: colors.heading,
    backgroundColor: colors.bgSecondary,
  },
  primaryBtn: {
    backgroundColor: palette.brand,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: colors.white, fontWeight: "700" },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listShell: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontWeight: "700", color: colors.heading, marginBottom: 4 },
  cardBody: { color: colors.body, fontSize: 13, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.heading, fontSize: 12, fontWeight: "600" },
  portalBadge: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  link: { color: palette.brand, marginTop: 8, fontWeight: "600" },
});
}
