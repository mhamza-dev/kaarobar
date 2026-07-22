import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { api, colors, getSession, type Session } from "../lib/api";
import { canAccess, canAccessRoute } from "../lib/rbac";
import { t } from "../lib/i18n";
import {
  type Customer,
  type CustomerForm,
  customerPayload,
  customerToForm,
  emptyCustomerForm,
} from "../lib/customers";

type LedgerEntry = {
  kind: string;
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
};

export default function CustomersScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm());
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
      const res = await api<{ data: Customer[] }>("/customers");
      setCustomers(res.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (!s) {
        router.replace("/landing");
        return;
      }
      if (!canAccessRoute(s, "/customers")) {
        router.replace("/dashboard");
        return;
      }
      setSession(s);
      await load();
    })();
  }, [load]);

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.phone || ""} ${c.company_name || ""}`.toLowerCase().includes(q);
  });

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const body = customerPayload(form);
      if (editingId) {
        await api(`/customers/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/customers", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyCustomerForm());
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
        body: JSON.stringify({ khata_enabled: !c.khata_enabled }),
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

      <TextInput
        style={styles.input}
        placeholder={t("customers.search")}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />

      <Pressable
        style={styles.primaryBtn}
        onPress={() => {
          setEditingId(null);
          setForm(emptyCustomerForm());
          setShowForm(true);
        }}
      >
        <Text style={styles.primaryBtnText}>{t("customers.add")}</Text>
      </Pressable>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{editingId ? t("customers.edit") : t("customers.add")}</Text>
          {(
            [
              ["name", "Name"],
              ["company_name", "Company"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["cnic", "CNIC"],
              ["ntn", "NTN"],
              ["address", "Address"],
              ["credit_limit", "Credit limit"],
              ["user_id", "Linked user ID"],
              ["notes", "Notes"],
            ] as const
          ).map(([key, label]) => (
            <TextInput
              key={key}
              style={styles.input}
              placeholder={label}
              placeholderTextColor={colors.muted}
              value={String(form[key] ?? "")}
              onChangeText={(v) => setForm({ ...form, [key]: v })}
            />
          ))}
          <View style={styles.row}>
            <Text style={styles.cardBody}>{t("customers.khata")}</Text>
            <Switch
              value={form.khata_enabled}
              onValueChange={(v) => setForm({ ...form, khata_enabled: v })}
            />
          </View>
          <Pressable style={styles.primaryBtn} disabled={busy} onPress={() => void save()}>
            <Text style={styles.primaryBtnText}>{busy ? t("common.loading") : t("common.save")}</Text>
          </Pressable>
          <Pressable onPress={() => setShowForm(false)}>
            <Text style={styles.link}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      ) : null}

      {filtered.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.cardTitle}>{c.name}</Text>
          <Text style={styles.cardBody}>
            {c.phone || "—"} · {c.company_name || "no company"} · pts {c.loyalty_points ?? 0}
          </Text>
          <Text style={styles.cardBody}>
            Khata {c.khata_enabled ? "On" : "Off"} · Balance {c.balance || "0"}
          </Text>
          <View style={styles.rowWrap}>
            <Pressable
              style={styles.chip}
              onPress={() => {
                setEditingId(c.id);
                setForm(customerToForm(c));
                setShowForm(true);
              }}
            >
              <Text style={styles.chipText}>{t("common.edit")}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => void toggleKhata(c)}>
              <Text style={styles.chipText}>{c.khata_enabled ? t("customers.disableKhata") : t("customers.enableKhata")}</Text>
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

      {ledger ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{ledger.customer.name} ledger</Text>
          <Text style={styles.cardBody}>Balance Rs {ledger.balance}</Text>
          {ledger.entries.map((e, i) => (
            <Text key={`${e.reference}-${i}`} style={styles.cardBody}>
              {e.date} · {e.kind} · {e.reference} · Dr {e.debit} Cr {e.credit}
            </Text>
          ))}
          <Pressable onPress={() => setLedger(null)}>
            <Text style={styles.link}>{t("common.close")}</Text>
          </Pressable>
        </View>
      ) : null}

      {canAccess(session, "marketing") ? (
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/marketing")}>
          <Text style={styles.primaryBtnText}>{t("nav.marketing")}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.brand,
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
  link: { color: colors.brand, marginTop: 8, fontWeight: "600" },
});
