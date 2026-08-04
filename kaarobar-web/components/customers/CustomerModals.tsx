"use client";

import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import type { Customer, CustomerForm } from "@/lib/customers";
import { CUSTOMER_FORM_FIELDS } from "@/lib/customers";
import type { FormEvent } from "react";

type Translate = (key: string, values?: Record<string, string | number>) => string;

type CustomerFormModalProps = {
  isOpen: boolean;
  busy: boolean;
  editing: Customer | null;
  form: CustomerForm;
  setForm: (next: CustomerForm) => void;
  t: Translate;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function CustomerFormModal({
  isOpen,
  busy,
  editing,
  form,
  setForm,
  t,
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("customers.edit") : t("customers.add")}
      footer={
        <Button type="submit" form="customer-form" loading={busy}>
          {editing ? t("common.save") : t("common.create")}
        </Button>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        {CUSTOMER_FORM_FIELDS.map((f) =>
          f.type === "checkbox" ? (
            <label key={f.key} className="flex items-center gap-2 text-sm text-heading sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(form[f.key])}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
              />
              {t(f.labelKey)}
            </label>
          ) : f.type === "textarea" ? (
            <Field key={f.key} label={t(f.labelKey)}>
              <textarea
                className={fieldClass}
                rows={3}
                value={String(form[f.key] ?? "")}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </Field>
          ) : (
            <Field key={f.key} label={t(f.labelKey)}>
              <input
                className={fieldClass}
                type={f.key === "credit_limit" ? "number" : f.type || "text"}
                step={f.key === "credit_limit" ? "0.01" : undefined}
                required={
                  f.required ||
                  (f.key === "portal_password" && form.portal_enabled && !editing?.portal_enabled)
                }
                minLength={f.type === "password" ? 8 : undefined}
                autoComplete={f.type === "password" ? "new-password" : undefined}
                placeholder={
                  f.key === "portal_password" && editing?.portal_enabled
                    ? t("customers.portalPasswordHint")
                    : undefined
                }
                value={String(form[f.key] ?? "")}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                onBlur={
                  f.key === "credit_limit"
                    ? (e) => {
                        if (e.target.value.trim() === "") return;
                        setForm({
                          ...form,
                          credit_limit: formatDecimal(e.target.value),
                        });
                      }
                    : undefined
                }
              />
              {f.hintKey ? <p className="mt-1 text-xs text-muted">{t(f.hintKey)}</p> : null}
            </Field>
          )
        )}
      </form>
    </Modal>
  );
}

type LoyaltyModalProps = {
  isOpen: boolean;
  busy: boolean;
  customerName: string;
  currentPoints: number;
  loyaltyDelta: string;
  loyaltyReason: string;
  setLoyaltyDelta: (next: string) => void;
  setLoyaltyReason: (next: string) => void;
  t: Translate;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function LoyaltyAdjustmentModal({
  isOpen,
  busy,
  customerName,
  currentPoints,
  loyaltyDelta,
  loyaltyReason,
  setLoyaltyDelta,
  setLoyaltyReason,
  t,
  onClose,
  onSubmit,
}: LoyaltyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("customers.adjustPointsTitle", { name: customerName })}
      footer={
        <Button type="submit" form="loyalty-form" loading={busy}>
          {t("customers.apply")}
        </Button>
      }
    >
      <form id="loyalty-form" onSubmit={onSubmit} className="grid gap-3">
        <p className="text-sm text-body">{t("customers.currentPoints", { count: currentPoints })}</p>
        <Field label={t("customers.delta")}>
          <input
            className={fieldClass}
            value={loyaltyDelta}
            onChange={(e) => setLoyaltyDelta(e.target.value)}
            required
          />
        </Field>
        <Field label={t("customers.reason")}>
          <input
            className={fieldClass}
            value={loyaltyReason}
            onChange={(e) => setLoyaltyReason(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
