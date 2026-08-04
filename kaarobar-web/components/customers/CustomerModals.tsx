"use client";

import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikCheckboxField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { formatDecimal } from "@/lib/decimal";
import type { Customer, CustomerForm } from "@/lib/customers";
import {
  CUSTOMER_FORM_FIELDS,
  customerToForm,
  emptyCustomerForm,
} from "@/lib/customers";
import {
  customerFormSchema,
  loyaltyAdjustSchema,
} from "@/lib/validations/customers";

type Translate = (key: string, values?: Record<string, string | number>) => string;

type CustomerFormModalProps = {
  isOpen: boolean;
  busy: boolean;
  editing: Customer | null;
  /** Overrides values derived from `editing` when provided. */
  initialValues?: CustomerForm;
  t: Translate;
  onClose: () => void;
  onSubmit: (values: CustomerForm) => void | Promise<void>;
};

export function CustomerFormModal({
  isOpen,
  busy,
  editing,
  initialValues,
  t,
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  const values =
    initialValues ?? (editing ? customerToForm(editing) : emptyCustomerForm());

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
      <CustomForm
        id="customer-form"
        className="grid gap-3 sm:grid-cols-2"
        initialValues={values}
        validationSchema={customerFormSchema}
        onSubmit={async (formValues) => {
          const next = { ...formValues };
          if (next.credit_limit.trim()) {
            next.credit_limit = formatDecimal(next.credit_limit);
          }
          await onSubmit(next);
        }}
      >
        {({ values: formValues }) => (
          <>
            {CUSTOMER_FORM_FIELDS.map((f) => {
              if (f.type === "checkbox") {
                return (
                  <FormikCheckboxField
                    key={f.key}
                    name={f.key}
                    label={t(f.labelKey)}
                    className="sm:col-span-2"
                  />
                );
              }
              if (f.type === "textarea") {
                return (
                  <FormikTextField
                    key={f.key}
                    name={f.key}
                    label={t(f.labelKey)}
                    type="textarea"
                    rows={3}
                  />
                );
              }
              return (
                <div key={f.key}>
                  <FormikTextField
                    name={f.key}
                    label={t(f.labelKey)}
                    type={f.key === "credit_limit" ? "number" : f.type || "text"}
                    required={
                      f.required ||
                      (f.key === "portal_password" &&
                        formValues.portal_enabled &&
                        !editing?.portal_enabled)
                    }
                    placeholder={
                      f.key === "portal_password" && editing?.portal_enabled
                        ? t("customers.portalPasswordHint")
                        : undefined
                    }
                  />
                  {f.hintKey ? (
                    <p className="mt-1 text-xs text-muted">{t(f.hintKey)}</p>
                  ) : null}
                </div>
              );
            })}
          </>
        )}
      </CustomForm>
    </Modal>
  );
}

type LoyaltyFormValues = {
  delta: number;
  reason: string;
};

type LoyaltyModalProps = {
  isOpen: boolean;
  busy: boolean;
  customerName: string;
  currentPoints: number;
  t: Translate;
  onClose: () => void;
  onSubmit: (values: LoyaltyFormValues) => void | Promise<void>;
};

export function LoyaltyAdjustmentModal({
  isOpen,
  busy,
  customerName,
  currentPoints,
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
      <CustomForm
        id="loyalty-form"
        className="grid gap-3"
        initialValues={{ delta: 10, reason: "" } satisfies LoyaltyFormValues}
        validationSchema={loyaltyAdjustSchema}
        onSubmit={async (values) => {
          await onSubmit({
            delta: Number(values.delta),
            reason: values.reason || "",
          });
        }}
      >
        {() => (
          <>
            <p className="text-sm text-body">
              {t("customers.currentPoints", { count: currentPoints })}
            </p>
            <FormikTextField name="delta" label={t("customers.delta")} type="number" required />
            <FormikTextField name="reason" label={t("customers.reason")} />
          </>
        )}
      </CustomForm>
    </Modal>
  );
}
