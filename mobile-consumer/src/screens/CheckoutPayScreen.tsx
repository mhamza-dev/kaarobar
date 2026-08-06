import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors, getSession } from "../lib/api";
import { useCart } from "../lib/cart";
import { useToast } from "../components/Toast";
import BuyerNav from "../components/BuyerNav";
import { brandPaletteFromPrimary } from "../lib/brandTheme";
import { useBrandPalette } from "../lib/BrandThemeContext";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
import { formatDecimal } from "../lib/decimal";
import CustomForm from "../components/ui/CustomForm";
import { FormikTextField } from "../components/ui/FormFields";
import {
  checkoutPaySchema,
  type CheckoutPayValues,
} from "../lib/validations/checkout";

export default function CheckoutPayScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const toast = useToast();
  const { stores, subtotal, clear, clearStore } = useCart();
  const staffBrand = useBrandPalette();
  const storePalette =
    stores.length === 1
      ? brandPaletteFromPrimary(stores[0].branding?.primaryColor)
      : staffBrand;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<CheckoutPayValues>({
    contactName: "",
    phone: "",
    pickupNotes: "",
    payMethod: "card",
  });

  useEffect(() => {
    if (stores.length === 0) {
      replacePath(navigation, "/app/dashboard");
      return;
    }
    void (async () => {
      const s = await getSession();
      if (s?.user) {
        setInitialValues((prev) => ({
          ...prev,
          contactName: prev.contactName || s.user.name || "",
          phone: prev.phone || s.user.phone || "",
        }));
      }
    })();
  }, [stores.length, navigation]);

  if (stores.length === 0) {
    return (
      <View style={styles.container}>
        <BuyerNav />
        <Text style={styles.empty}>Your cart is empty.</Text>
      </View>
    );
  }

  async function placeOrder(values: CheckoutPayValues) {
    if (stores.length === 0) return;
    const name = values.contactName.trim();
    const phoneVal = values.phone.trim();
    const noteParts = [
      `Pickup contact: ${name}`,
      `Phone: ${phoneVal}`,
      values.pickupNotes.trim() ? `Notes: ${values.pickupNotes.trim()}` : null,
    ].filter(Boolean);
    const notes = noteParts.join(" · ");

    setSubmitError(null);
    const snapshot = [...stores];
    let placed = 0;
    const failed: string[] = [];

    for (const store of snapshot) {
      try {
        await api("/portal/orders", {
          method: "POST",
          body: JSON.stringify({
            business_id: store.businessId,
            payment_method: values.payMethod,
            notes,
            items: store.lines.map((l) => ({
              product_id: l.productId,
              quantity: l.quantity,
            })),
          }),
        });
        placed += 1;
        clearStore(store.businessId);
      } catch (err) {
        failed.push(
          `${store.businessName}: ${err instanceof Error ? err.message : "Failed"}`
        );
      }
    }

    if (failed.length === 0) {
      clear();
      toast.success(placed === 1 ? "Order placed" : `${placed} orders placed`);
      replacePath(navigation, "/app/sales");
      return;
    }

    if (placed > 0) {
      toast.success(`${placed} order(s) placed; ${failed.length} failed`);
    }
    setSubmitError(failed.join(" · "));
  }

  return (
    <View style={styles.container}>
      <BuyerNav />
      <Text style={styles.title}>Contact & payment</Text>
      <Text style={styles.sub}>
        {stores.length === 1
          ? `Pickup from ${stores[0].businessName}`
          : `${stores.length} store pickups`}{" "}
        · Rs {formatDecimal(subtotal)}
      </Text>
      {stores.length > 1 ? (
        <View style={styles.summary}>
          {stores.map((s) => {
            const total = s.lines.reduce((a, l) => a + l.quantity * l.price, 0);
            return (
              <Text key={s.businessId} style={styles.summaryRow}>
                {s.businessName} · Rs {formatDecimal(total)}
              </Text>
            );
          })}
          <Text style={styles.hint}>
            Each store is a separate pickup order with the same contact details.
          </Text>
        </View>
      ) : null}
      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <CustomForm
        initialValues={initialValues}
        validationSchema={checkoutPaySchema}
        onSubmit={placeOrder}
      >
        {({ values, setFieldValue, handleSubmit, isSubmitting }) => (
          <View>
            <FormikTextField
              name="contactName"
              label="Name"
              style={{ marginBottom: 8 }}
              inputStyle={styles.input}
            />
            <FormikTextField
              name="phone"
              label="Phone"
              keyboardType="phone-pad"
              style={{ marginBottom: 8 }}
              inputStyle={styles.input}
            />
            <FormikTextField
              name="pickupNotes"
              label="Pickup notes"
              multiline
              placeholder="e.g. ready after 5pm"
              style={{ marginBottom: 8 }}
              inputStyle={[styles.input, { minHeight: 72 }]}
            />

            <Text style={styles.label}>Payment</Text>
            <View style={styles.payRow}>
              {(["card", "wallet"] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[
                    styles.payBtn,
                    values.payMethod === m && {
                      backgroundColor: storePalette.brand,
                      borderColor: storePalette.brand,
                    },
                  ]}
                  onPress={() => void setFieldValue("payMethod", m)}
                >
                  <Text
                    style={[
                      styles.payText,
                      values.payMethod === m && {
                        color: storePalette.brandForeground,
                      },
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[
                styles.cta,
                { backgroundColor: storePalette.brand },
                isSubmitting && { opacity: 0.5 },
              ]}
              disabled={isSubmitting}
              onPress={() => handleSubmit()}
            >
              {isSubmitting ? (
                <ActivityIndicator color={storePalette.brandForeground} />
              ) : (
                <Text
                  style={[
                    styles.ctaText,
                    { color: storePalette.brandForeground },
                  ]}
                >
                  {stores.length > 1
                    ? `Place ${stores.length} orders`
                    : "Place order"}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </CustomForm>
      <Pressable onPress={() => pushPath(navigation, "/app/checkout")}>
        <Text style={[styles.back, { color: storePalette.brand }]}>
          ← Back to cart
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, padding: 16 },
  empty: { color: colors.body, marginTop: 24 },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading },
  sub: { color: colors.body, marginBottom: 12, marginTop: 4 },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  summaryRow: { color: colors.heading, fontWeight: "600", fontSize: 13 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  error: { color: colors.danger, marginBottom: 8 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.heading,
    backgroundColor: colors.card,
  },
  payRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  payBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payText: {
    color: colors.heading,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  cta: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { fontWeight: "700" },
  back: { fontWeight: "700", marginTop: 14, textAlign: "center" },
});
