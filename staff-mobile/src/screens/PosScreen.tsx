import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Theme, useTheme } from "@/theme";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, apiAllPages, getSession, type Session } from "@/lib/api";
import { uuid } from "@core/lib/uuid";
import { t } from "@shared/i18n";
import { canAccessRoute } from "@/lib/rbac";
import { formatDecimal } from "@core/lib/decimal";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BarcodeScannerModal } from "@/components/barcode-scanner-modal";
import { PressableScale } from "@shared/ui/pressable-scale";
import { SheetModal } from "@shared/ui/sheet-modal";
import { Screen } from "@shared/ui/screen";
import { LoadingView, StateView } from "@shared/ui/state-view";
import { pushPath, replacePath } from "@/lib/nav";

type Product = {
  id: string;
  sku: string;
  name: string;
  price?: string;
  tax_rate?: string;
  barcode?: string;
  image_url?: string;
};

type CartLine = { product: Product; quantity: number; unit_price: number };

type Customer = { id: string; name: string; credit_enabled?: boolean };

type Receipt = {
  invoice_number: string;
  total_amount: string;
  customer_name?: string | null;
  items: { name: string; quantity: string; line_total: string }[];
  payments: { method: string; amount: string }[];
};

type Till = {
  id: string;
  status: string;
  opening_cash: string;
  over_short?: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const PRODUCT_PAGE_SIZE = 100;

export default function PosScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [session, setLocal] = useState<Session | null>(null);
  /** Explicit gate so "loading" is never confused with "denied" or "failed". */
  const [gate, setGate] = useState<
    "loading" | "ready" | "denied" | "signedOut" | "error"
  >("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [till, setTill] = useState<Till | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payWallet, setPayWallet] = useState("");
  const [payKhata, setPayKhata] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [tillOpen, setTillOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");

  const loadTill = useCallback(async () => {
    try {
      const res = await api<{ data: Till | null }>("/tills/current");
      setTill(res.data);
    } catch {
      setTill(null);
    }
  }, []);

  const loadProductPage = useCallback(
    async (opts: { reset: boolean; cursor?: string | null; q: string }) => {
      const { reset, q } = opts;
      if (reset) setProductsLoading(true);
      else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PRODUCT_PAGE_SIZE));
        if (opts.cursor) params.set("cursor", opts.cursor);
        if (q) params.set("q", q);
        const res = await api<{
          data: Product[];
          meta?: { next_cursor?: string | null };
        }>(`/products?${params.toString()}`);
        const rows = res.data || [];
        setProducts((prev) => (reset ? rows : [...prev, ...rows]));
        setNextCursor(res.meta?.next_cursor ?? null);
      } catch (err) {
        if (reset) setProducts([]);
        setMessage(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setProductsLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      let s: Session | null = null;
      try {
        s = await getSession();
      } catch {
        setGate("error");
        return;
      }
      if (!s) {
        setGate("signedOut");
        replacePath("/landing");
        return;
      }
      if (!canAccessRoute(s, "/app/pos")) {
        // Previously this redirected and left `session` null forever, so the
        // screen spun indefinitely if the user came back to the POS tab.
        setGate("denied");
        return;
      }
      setGate("ready");
      setLocal(s);
      try {
        const cust = await apiAllPages<Customer>("/customers").catch(() => [] as Customer[]);
        setCustomers(cust);
        await loadTill();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, [loadTill, reloadKey]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!session) return;
    // `loadProductPage` flips its loading flag synchronously so the spinner
    // shows on the same frame as the keystroke. That is one extra render per
    // fetch, not a cascade. Reworking POS pagination onto TanStack Query to
    // satisfy the rule is not worth touching a money path for (POS-FR-*).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProductPage({ reset: true, q: debouncedQ });
  }, [session, debouncedQ, loadProductPage]);

  const filtered = products;
  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const customerMatches = customerQuery.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerQuery.trim().toLowerCase())
      )
    : customers;

  async function lookupBarcode(code: string) {
    try {
      const res = await api<{ data: Product }>(
        `/products/by-barcode/${encodeURIComponent(code)}`
      );
      addProduct(res.data);
      setMessage(`Added ${res.data.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Barcode not found");
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discount = round2(Math.min(Math.max(Number(discountInput || 0), 0), subtotal));
  const tax = round2(Math.max(Number(taxInput || 0), 0));
  const total = round2(subtotal - discount + tax);

  // Reset the tender split whenever the order total changes. Done during render
  // so the payment fields never paint one frame with the previous total.
  const [lastTotal, setLastTotal] = useState(total);
  if (total !== lastTotal) {
    setLastTotal(total);
    setPayCash(formatDecimal(total));
    setPayCard("");
    setPayWallet("");
    setPayKhata("");
  }

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: Number(product.price || 0) },
      ];
    });
  }

  function setQty(productId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    const next = Math.min(Math.max(Math.floor(quantity), 1), 99_999);
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, quantity: next } : l))
    );
  }

  async function openTill() {
    if (!session?.branch_id) {
      setMessage("Select a branch from the dashboard first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Till }>("/tills/open", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          opening_cash: openingCash || "0",
        }),
      });
      setTill(res.data);
      setMessage("Till opened");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open till");
    } finally {
      setBusy(false);
    }
  }

  async function closeTill() {
    if (!till?.id) return;
    setBusy(true);
    try {
      const res = await api<{ data: Till }>(`/tills/${till.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closing_cash: closingCash || "0" }),
      });
      setTill(null);
      setClosingCash("");
      const over = res.data.over_short;
      setMessage(
        over && Number(over) !== 0
          ? `Till closed (over/short ${over})`
          : "Till closed"
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not close till");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!session?.branch_id) {
      setMessage("Select a branch from the dashboard first.");
      return;
    }
    const payments: { method: string; amount: number }[] = [];
    const cash = Number(payCash || 0);
    const card = Number(payCard || 0);
    const wallet = Number(payWallet || 0);
    const khata = Number(payKhata || 0);
    if (cash > 0) payments.push({ method: "cash", amount: round2(cash) });
    if (card > 0) payments.push({ method: "card", amount: round2(card) });
    if (wallet > 0) payments.push({ method: "wallet", amount: round2(wallet) });
    if (khata > 0) payments.push({ method: "credit", amount: round2(khata) });
    const paySum = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (payments.length === 0 || Math.abs(paySum - total) > 0.001) {
      setMessage(`Payments must total ${formatDecimal(total)} (got ${formatDecimal(paySum)})`);
      return;
    }
    if (khata > 0 && !customerId) {
      setMessage("Select a customer for credit");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Receipt }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          client_txn_id: uuid(),
          till_id: till?.id,
          customer_id: customerId || undefined,
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.quantity,
          })),
          discount_amount: discount,
          tax_amount: tax,
          payments,
        }),
      });
      setCart([]);
      setReceipt(res.data);
      setMessage(`Sale ${res.data.invoice_number}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (gate !== "ready" || !session) {
    return (
      <Screen>
        {gate === "loading" || gate === "signedOut" ? (
          <LoadingView label={t("common.workspaceLoading")} />
        ) : gate === "denied" ? (
          <StateView
            icon="lock-closed-outline"
            tone="warning"
            title="POS isn't available for your role"
            detail="Your account doesn't have till access on this branch. An owner or branch manager can grant it from Settings → Roles."
            actionLabel="Go to workspace"
            onAction={() => pushPath("/app/dashboard")}
          />
        ) : (
          <StateView
            icon="cloud-offline-outline"
            tone="danger"
            title="Couldn't start the till"
            detail="We couldn't read your session. Check your connection and try again."
            actionLabel="Retry"
            onAction={() => {
              setGate("loading");
              setReloadKey((n) => n + 1);
            }}
          />
        )}
      </Screen>
    );
  }

  // Rendered as the list header rather than wrapping the list in a
  // ScrollView: a FlatList inside a same-orientation ScrollView breaks
  // windowing (RN warns about it) and would render every product at once.
  const productHeader = (
    <>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Cashier</Text>
            <Text style={styles.title}>Point of sale</Text>
          </View>

          <PressableScale
            haptic
            onPress={() => setTillOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={till ? "Close till" : "Open till"}
            style={[styles.headerBtn, { borderColor: till ? theme.success : theme.border }]}
          >
            <Ionicons
              name={till ? "lock-open-outline" : "lock-closed-outline"}
              size={20}
              color={till ? theme.success : theme.muted}
            />
          </PressableScale>

          <PressableScale
            haptic
            onPress={() => setCartOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            style={[styles.headerBtn, { borderColor: theme.border }]}
          >
            <Ionicons name="cart-outline" size={20} color={theme.brandOn} />
            {cartCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.brand }]}>
                <Text style={[styles.badgeText, { color: theme.brandForeground }]}>
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search SKU / name"
            placeholderTextColor={theme.muted}
          />
          <PressableScale
            haptic
            onPress={() => setScanOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
            style={[styles.scanIconBtn, { backgroundColor: theme.brand }]}
          >
            <Ionicons name="barcode-outline" size={22} color={theme.brandForeground} />
          </PressableScale>
        </View>

        <Text style={styles.count}>
          {productsLoading
            ? "Loading…"
            : `${filtered.length} products${nextCursor ? "+" : ""}`}
        </Text>
    </>
  );

  return (
    <>
    <View style={styles.container}>
      <FlatList
        data={productsLoading ? [] : filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={styles.gridContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={productHeader}
        ListEmptyComponent={
          productsLoading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.brandOn} />
          ) : (
            <Text style={styles.body}>No products match this search.</Text>
          )
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (nextCursor && !loadingMoreRef.current) {
            void loadProductPage({ reset: false, cursor: nextCursor, q: debouncedQ });
          }
        }}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color={theme.brand} />
          ) : null
        }
        renderItem={({ item: p }) => {
          const inCart = cart.find((l) => l.product.id === p.id);
          return (
            <Pressable
              style={[styles.product, inCart ? styles.productActive : null, { flex: 1 }]}
              onPress={() => addProduct(p)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {p.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
              <Text style={styles.productName}>{p.name}</Text>
              <Text style={styles.sku}>{p.sku}</Text>
              <View style={styles.productFooter}>
                <Text style={styles.productPrice}>Rs {formatDecimal(p.price)}</Text>
                {inCart ? (
                  <Text style={styles.qtyChip}>×{inCart.quantity}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
    <BarcodeScannerModal
      visible={scanOpen}
      onClose={() => setScanOpen(false)}
      onScan={lookupBarcode}
      title="Scan to cart"
    />
    {receipt ? (
      <View style={styles.receiptOverlay}>
        <View style={styles.receiptCard}>
          <Text style={styles.title}>Invoice {receipt.invoice_number}</Text>
          {receipt.customer_name ? (
            <Text style={styles.body}>Customer: {receipt.customer_name}</Text>
          ) : null}
          {receipt.items.map((item, i) => (
            <Text key={`${item.name}-${i}`} style={styles.body}>
              {item.name} × {item.quantity} · {formatDecimal(item.line_total)}
            </Text>
          ))}
          <Text style={styles.total}>Total Rs {formatDecimal(receipt.total_amount)}</Text>
          {receipt.payments.map((p, i) => (
            <Text key={`${p.method}-${i}`} style={styles.body}>
              {p.method}: {p.amount}
            </Text>
          ))}
          <Pressable style={styles.btn} onPress={() => setReceipt(null)}>
            <Text style={styles.btnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    ) : null}

    <SheetModal
      visible={cartOpen}
      onClose={() => setCartOpen(false)}
      title="Order detail"
      subtitle={cartCount > 0 ? `${cartCount} item${cartCount === 1 ? "" : "s"}` : "Cart is empty"}
      footer={
        <PressableScale
          haptic
          onPress={() => {
            setCartOpen(false);
            void checkout();
          }}
          disabled={cart.length === 0 || busy}
          accessibilityRole="button"
          style={[
            styles.btn,
            styles.charge,
            cart.length === 0 || busy ? styles.btnDisabled : null,
          ]}
        >
          <Text style={styles.btnText}>
            {busy ? t("pos.processing") : `${t("pos.placeOrder")} · Rs ${formatDecimal(total)}`}
          </Text>
        </PressableScale>
      }
    >
      {cart.length === 0 ? (
        <Text style={styles.body}>Cart is empty — tap a product to start.</Text>
      ) : (
        cart.map((l) => (
          <View key={l.product.id} style={styles.cartLine}>
            <Text style={styles.productName}>{l.product.name}</Text>
            <View style={styles.row}>
              <Pressable style={styles.qtyBtn} onPress={() => setQty(l.product.id, l.quantity - 1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <TextInput
                style={styles.qtyInput}
                value={String(l.quantity)}
                keyboardType="number-pad"
                selectTextOnFocus
                onChangeText={(raw) => {
                  const digits = raw.replace(/[^0-9]/g, "");
                  if (digits === "") return;
                  const n = Number.parseInt(digits, 10);
                  if (Number.isFinite(n) && n > 0) setQty(l.product.id, Math.min(n, 99999));
                }}
              />
              <Pressable style={styles.qtyBtn} onPress={() => setQty(l.product.id, l.quantity + 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
              <Text style={styles.lineTotal}>{formatDecimal(l.quantity * l.unit_price)}</Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.totals}>
        <Text style={styles.body}>{t("common.subtotal")} {formatDecimal(subtotal)}</Text>
        <View style={styles.row}>
          <Text style={[styles.body, { width: 88, marginBottom: 0 }]}>{t("pos.discount")}</Text>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={discountInput}
            onChangeText={setDiscountInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.muted}
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.body, { width: 88, marginBottom: 0 }]}>{t("pos.taxOptional")}</Text>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={taxInput}
            onChangeText={setTaxInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.muted}
          />
        </View>
        <Text style={styles.total}>{t("common.total")} Rs {formatDecimal(total)}</Text>
      </View>

      <Text style={styles.payLabel}>Customer</Text>
      <PressableScale
        haptic
        onPress={() => setCustomerPickerOpen(true)}
        accessibilityRole="button"
        style={styles.attachRow}
      >
        <Ionicons
          name={selectedCustomer ? "person-circle-outline" : "person-add-outline"}
          size={20}
          color={theme.brandOn}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.attachLabel}>
            {selectedCustomer ? selectedCustomer.name : "Attach customer"}
          </Text>
          <Text style={styles.attachHint}>
            {selectedCustomer
              ? selectedCustomer.credit_enabled
                ? `${t("pos.khata")} enabled`
                : "Walk-in account"
              : "Required for khata payments"}
          </Text>
        </View>
        {selectedCustomer ? (
          <Pressable
            hitSlop={10}
            accessibilityLabel="Detach customer"
            onPress={() => setCustomerId("")}
          >
            <Ionicons name="close-circle" size={20} color={theme.muted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        )}
      </PressableScale>

      <Text style={styles.payLabel}>Payment</Text>
      {(
        [
          ["Cash", payCash, setPayCash],
          ["Card", payCard, setPayCard],
          ["Wallet", payWallet, setPayWallet],
          [t("pos.khata"), payKhata, setPayKhata],
        ] as const
      ).map(([label, value, setter]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.body, { width: 56, marginBottom: 0 }]}>{label}</Text>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={value}
            onChangeText={setter}
            keyboardType="decimal-pad"
            placeholderTextColor={theme.muted}
          />
        </View>
      ))}
    </SheetModal>

    <SheetModal
      visible={customerPickerOpen}
      onBack={() => setCustomerPickerOpen(false)}
      onClose={() => setCustomerPickerOpen(false)}
      title="Attach customer"
      subtitle="Search by name"
    >
      <TextInput
        style={styles.input}
        value={customerQuery}
        onChangeText={setCustomerQuery}
        placeholder="Search customers"
        placeholderTextColor={theme.muted}
        autoCorrect={false}
      />
      {customerMatches.length === 0 ? (
        <Text style={styles.body}>No customers match that search.</Text>
      ) : (
        customerMatches.slice(0, 50).map((c) => (
          <PressableScale
            key={c.id}
            haptic
            scaleTo={0.99}
            accessibilityRole="button"
            onPress={() => {
              setCustomerId(c.id);
              setCustomerQuery("");
              setCustomerPickerOpen(false);
            }}
            style={[styles.attachRow, customerId === c.id && { borderColor: theme.brandOn }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.attachLabel}>{c.name}</Text>
              {c.credit_enabled ? (
                <Text style={styles.attachHint}>{t("pos.khata")} enabled</Text>
              ) : null}
            </View>
            {customerId === c.id ? (
              <Ionicons name="checkmark-circle" size={20} color={theme.success} />
            ) : null}
          </PressableScale>
        ))
      )}
    </SheetModal>

    <SheetModal
      visible={tillOpen}
      onClose={() => setTillOpen(false)}
      title={till ? "Close till" : "Open till"}
      subtitle={
        till ? `Open · float Rs ${formatDecimal(till.opening_cash)}` : "Start a cash session"
      }
    >
      {till ? (
        <>
          <Text style={styles.body}>Count the drawer and enter the closing cash.</Text>
          <TextInput
            style={styles.input}
            value={closingCash}
            onChangeText={setClosingCash}
            placeholder="Closing cash"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.muted}
          />
          <PressableScale
            haptic
            disabled={busy}
            accessibilityRole="button"
            onPress={() => {
              setTillOpen(false);
              void closeTill();
            }}
            style={[styles.btn, busy ? styles.btnDisabled : null]}
          >
            <Text style={styles.btnText}>Close till</Text>
          </PressableScale>
        </>
      ) : (
        <>
          <Text style={styles.body}>Enter the opening float to start selling.</Text>
          <TextInput
            style={styles.input}
            value={openingCash}
            onChangeText={setOpeningCash}
            placeholder="Opening cash"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.muted}
          />
          <PressableScale
            haptic
            disabled={busy}
            accessibilityRole="button"
            onPress={() => {
              setTillOpen(false);
              void openTill();
            }}
            style={[styles.btn, busy ? styles.btnDisabled : null]}
          >
            <Text style={styles.btnText}>Open till</Text>
          </PressableScale>
        </>
      )}
    </SheetModal>
    </>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.bgPrimary,
  },
  container: { flex: 1, padding: 16, backgroundColor: t.bgPrimary },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.card,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  scanIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.card,
    borderRadius: t.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  attachLabel: { fontWeight: "700", color: t.heading, fontSize: 15 },
  attachHint: { fontSize: 12, color: t.muted, marginTop: 2 },
  gridContent: { gap: 8, paddingBottom: 8 },
  eyebrow: {
    color: t.brand,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: { fontSize: 26, fontWeight: "800", color: t.heading, marginBottom: 8, marginTop: 4 },
  message: { color: t.body, marginBottom: 8 },
  scanBtn: {
    backgroundColor: t.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  count: { color: t.muted, fontSize: 13, marginBottom: 10, fontWeight: "600" },
  card: {
    backgroundColor: t.card,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  section: { fontWeight: "700", color: t.heading, marginBottom: 8, fontSize: 16 },
  body: { color: t.body, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: t.bgSecondary,
    color: t.heading,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  btn: {
    backgroundColor: t.brand,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  charge: { marginTop: 8, paddingVertical: 14 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: t.white, fontWeight: "700" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: t.bgSecondary,
  },
  btnSecondaryText: { color: t.heading, fontWeight: "600" },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  product: {
    width: "47%",
    backgroundColor: t.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    padding: 12,
  },
  productActive: {
    borderColor: t.brand,
    backgroundColor: t.brandLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { color: t.brand, fontWeight: "800", fontSize: 13 },
  productName: { fontWeight: "700", color: t.heading },
  sku: { color: t.muted, fontSize: 12, marginTop: 2 },
  productFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productPrice: { color: t.heading, fontWeight: "700" },
  qtyChip: {
    backgroundColor: t.brandSoft,
    color: t.brand,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  cartLine: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  qtyBtn: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 10,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.bgSecondary,
  },
  qtyBtnText: { fontSize: 18, color: t.heading },
  qty: { width: 28, textAlign: "center", color: t.heading, fontWeight: "700" },
  qtyInput: {
    width: 52,
    height: 36,
    textAlign: "center",
    color: t.heading,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: t.card,
  },
  lineTotal: { marginLeft: "auto", fontWeight: "700", color: t.heading },
  totals: { marginTop: 8, marginBottom: 8 },
  total: { fontSize: 22, fontWeight: "800", color: t.heading, marginTop: 4 },
  payLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    color: t.muted,
    textTransform: "uppercase",
  },
  chip: {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: t.card,
  },
  chipOn: { backgroundColor: t.brand, borderColor: t.brand },
  chipText: { color: t.heading, fontWeight: "600", fontSize: 12 },
  chipTextOn: { color: t.white },
  receiptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  receiptCard: {
    width: "100%",
    backgroundColor: t.bgSecondary,
    borderRadius: 12,
    padding: 16,
  },
});
}
