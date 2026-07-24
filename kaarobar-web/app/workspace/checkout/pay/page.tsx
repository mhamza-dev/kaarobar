"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getSession, isConsumerSession } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  Alert,
  EmptyState,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { BrandThemeScope } from "@/components/app/BrandTheme";
import { useT } from "@/lib/i18n";

function money(n: number) {
  return n.toFixed(2);
}

export default function CheckoutPayPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { stores, subtotal, clear, clearStore } = useCart();
  const session = getSession();

  const [contactName, setContactName] = useState(session?.user?.name || "");
  const [phone, setPhone] = useState(session?.user?.phone || "");
  const [pickupNotes, setPickupNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stores.length === 0) {
      router.replace("/app");
    }
  }, [stores.length, router]);

  useEffect(() => {
    const s = getSession();
    if (s?.user) {
      setContactName((prev) => prev || s.user.name || "");
      setPhone((prev) => prev || s.user.phone || "");
    }
  }, []);

  if (stores.length === 0) {
    return (
      <EmptyState title={t("marketplace.emptyCartTitle")} body={t("marketplace.emptyCartBody")} />
    );
  }

  async function placeOrder() {
    if (!getSession() || !isConsumerSession()) {
      router.push("/login?as=consumer");
      return;
    }
    if (stores.length === 0) return;

    const name = contactName.trim();
    const phoneVal = phone.trim();
    if (!name || !phoneVal) {
      setError("Contact name and phone are required for pickup.");
      return;
    }

    const noteParts = [
      `Pickup contact: ${name}`,
      `Phone: ${phoneVal}`,
      pickupNotes.trim() ? `Notes: ${pickupNotes.trim()}` : null,
    ].filter(Boolean);
    const notes = noteParts.join(" · ");

    setBusy(true);
    setError(null);

    const placed: string[] = [];
    const failed: { name: string; message: string }[] = [];

    try {
      for (const store of stores) {
        try {
          const res = await api<{
            data: { invoice_number: string; total_amount: string };
          }>("/portal/orders", {
            method: "POST",
            body: JSON.stringify({
              business_id: store.businessId,
              payment_method: payMethod,
              notes,
              items: store.lines.map((l) => ({
                product_id: l.productId,
                quantity: l.quantity,
              })),
            }),
          });
          placed.push(
            `${store.businessName}: ${res.data.invoice_number} (Rs ${res.data.total_amount})`
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
      setError(
        failed.map((f) => `${f.name}: ${f.message}`).join(" · ")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <BrandThemeScope
      primaryColor={stores.length === 1 ? stores[0].branding?.primaryColor : null}
      className="mx-auto max-w-lg space-y-6"
    >
      <PageHeader
        eyebrow={t("marketplace.checkoutEyebrow")}
        title={t("pages.checkoutPayTitle")}
        description={
          stores.length === 1
            ? `${stores[0].businessName} · Rs ${money(subtotal)}`
            : `${stores.length} · Rs ${money(subtotal)} · ${t("pages.checkoutPayDesc")}`
        }
        infoKey="page.checkout.pay"
      />

      {stores.length > 1 ? (
        <SurfaceCard className="space-y-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Orders to place
          </p>
          <ul className="space-y-1 text-sm text-body">
            {stores.map((s) => {
              const total = s.lines.reduce((a, l) => a + l.quantity * l.price, 0);
              return (
                <li key={s.businessId} className="flex justify-between gap-2">
                  <span className="font-medium text-heading">{s.businessName}</span>
                  <span className="tabular-nums">Rs {money(total)}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            Each store is a separate pickup order with the same contact details.
          </p>
        </SurfaceCard>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <SurfaceCard className="space-y-4 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          {t("marketplace.pickupContact")}
        </p>
        <label className="block text-sm text-body">
          Name
          <input
            className={`${fieldClass} mt-1`}
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm text-body">
          Phone
          <input
            className={`${fieldClass} mt-1`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </label>
        <label className="block text-sm text-body">
          {t("marketplace.pickupNotes")}
          <textarea
            className={`${fieldClass} mt-1`}
            rows={3}
            placeholder="e.g. ready after 5pm, ask for counter 2"
            value={pickupNotes}
            onChange={(e) => setPickupNotes(e.target.value)}
          />
        </label>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            {t("marketplace.payment")}
          </p>
          <div className="flex gap-2">
            {(["card", "wallet"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPayMethod(m)}
                className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${
                  payMethod === m
                    ? "bg-brand text-brand-foreground"
                    : "border border-border text-heading"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Card / wallet capture is stubbed for demo — placing the order records the sale.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 font-bold text-heading">
          <span>Total</span>
          <span>Rs {money(subtotal)}</span>
        </div>

        <Button className="w-full" disabled={busy} loading={busy} onClick={() => void placeOrder()}>
          {stores.length > 1
            ? t("marketplace.placeOrders", { count: stores.length })
            : t("marketplace.placeOrder")}
        </Button>
        <Link
          href="/app/checkout"
          className="block text-center text-sm font-medium text-brand hover:underline"
        >
          ← Back to cart
        </Link>
      </SurfaceCard>
    </BrandThemeScope>
  );
}
