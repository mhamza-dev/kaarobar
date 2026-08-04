"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getSession, isConsumerSession } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import { FormikTextField } from "@/components/ui/FormFields";
import { useToast } from "@/components/ui/Toast";
import { Alert } from "@/components/app/ui";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import {
  BuyerBackLink,
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import {
  checkoutPaySchema,
  type CheckoutPayValues,
} from "@/lib/validations/checkout";
import { ShoppingCart } from "lucide-react";

export default function CheckoutPayPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { stores, subtotal, clear, clearStore } = useCart();
  const session = getSession();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [initialValues, setInitialValues] = useState<CheckoutPayValues>({
    contactName: session?.user?.name || "",
    phone: session?.user?.phone || "",
    pickupNotes: "",
    payMethod: "card",
  });

  useEffect(() => {
    if (stores.length === 0) {
      router.replace("/app");
    }
  }, [stores.length, router]);

  useEffect(() => {
    const s = getSession();
    if (s?.user) {
      setInitialValues((prev) => ({
        ...prev,
        contactName: prev.contactName || s.user.name || "",
        phone: prev.phone || s.user.phone || "",
      }));
    }
  }, []);

  if (stores.length === 0) {
    return (
      <BuyerEmptyPanel
        icon={<ShoppingCart className="h-7 w-7" />}
        title={t("marketplace.emptyCartTitle")}
        body={t("marketplace.emptyCartBody")}
      />
    );
  }

  async function placeOrder(values: CheckoutPayValues) {
    if (!getSession() || !isConsumerSession()) {
      router.push("/login?as=consumer");
      return;
    }
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

    const placed: string[] = [];
    const failed: { name: string; message: string }[] = [];

    for (const store of stores) {
      try {
        const res = await api<{
          data: { invoice_number: string; total_amount: string };
        }>("/portal/orders", {
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
        placed.push(
          `${store.businessName}: ${res.data.invoice_number} (Rs ${formatDecimal(res.data.total_amount)})`
        );
        clearStore(store.businessId);
      } catch (err) {
        failed.push({
          name: store.businessName,
          message: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    if (failed.length === 0) {
      clear();
      toast.success(
        placed.length === 1
          ? `Order placed · ${placed[0]}`
          : `${placed.length} orders placed`
      );
      router.push("/app/sales");
      return;
    }

    if (placed.length > 0) {
      toast.success(`${placed.length} order(s) placed; ${failed.length} failed`);
    }
    setSubmitError(failed.map((f) => `${f.name}: ${f.message}`).join(" · "));
  }

  return (
    <BrandThemeScope
      primaryColor={stores.length === 1 ? stores[0].branding?.primaryColor : null}
      className="mx-auto max-w-lg space-y-6"
    >
      <BuyerBackLink href="/app/checkout">{t("marketplace.backToCart")}</BuyerBackLink>
      <BuyerHero
        eyebrow={t("marketplace.checkoutEyebrow")}
        title={t("pages.checkoutPayTitle")}
        description={
          stores.length === 1
            ? `${stores[0].businessName} · Rs ${formatDecimal(subtotal)}`
            : `${t("marketplace.orderIncludesShops", { count: stores.length })} · Rs ${formatDecimal(subtotal)}`
        }
        infoKey="page.checkout.pay"
      >
        {stores.length > 1 ? (
          <p className="mt-2 text-sm text-body">{t("marketplace.multiShopCartHint")}</p>
        ) : null}
      </BuyerHero>

      {stores.length > 1 ? (
        <BuyerCard className="space-y-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {t("marketplace.ordersToPlace")}
          </p>
          <ul className="space-y-1 text-sm text-body">
            {stores.map((s) => {
              const total = s.lines.reduce((a, l) => a + l.quantity * l.price, 0);
              return (
                <li key={s.businessId} className="flex justify-between gap-2">
                  <span className="font-medium text-heading">{s.businessName}</span>
                  <span className="tabular-nums">Rs {formatDecimal(total)}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">{t("marketplace.multiStoreCheckoutHint")}</p>
        </BuyerCard>
      ) : null}

      {submitError ? <Alert tone="error">{submitError}</Alert> : null}

      <CustomForm
        initialValues={initialValues}
        validationSchema={checkoutPaySchema}
        onSubmit={placeOrder}
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <BuyerCard className="space-y-4 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("marketplace.pickupContact")}
            </p>
            <FormikTextField
              name="contactName"
              label={t("auth.fullName")}
              required
              autoComplete="name"
            />
            <FormikTextField
              name="phone"
              label={t("auth.phone")}
              type="tel"
              required
              autoComplete="tel"
            />
            <FormikTextField
              name="pickupNotes"
              label={t("marketplace.pickupNotes")}
              type="textarea"
              rows={3}
              placeholder={t("marketplace.pickupNotesPlaceholder")}
            />

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {t("marketplace.payment")}
              </p>
              <div className="flex gap-2">
                {(["card", "wallet"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => void setFieldValue("payMethod", m)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${
                      values.payMethod === m
                        ? "bg-brand text-brand-foreground"
                        : "border border-border text-heading"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{t("marketplace.paymentStubHint")}</p>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 font-bold text-heading">
              <span>{t("common.total")}</span>
              <span>Rs {formatDecimal(subtotal)}</span>
            </div>

            <Button
              type="submit"
              className="w-full rounded-md"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {stores.length > 1
                ? t("marketplace.placeOrders", { count: stores.length })
                : t("marketplace.placeOrder")}
            </Button>
            <Link
              href="/app/checkout"
              className="block text-center text-sm font-medium text-brand hover:underline"
            >
              {t("marketplace.backToCart")}
            </Link>
          </BuyerCard>
        )}
      </CustomForm>
    </BrandThemeScope>
  );
}
