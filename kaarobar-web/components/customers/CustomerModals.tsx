"use client";

import FormModal from "@/components/app/FormModal";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSwitchField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { formGridClass, formStackClass } from "@/components/app/ui";
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
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("customers.edit") : t("customers.add")}
      formId="customer-form"
      submitLabel={editing ? t("common.save") : t("common.create")}
      cancelLabel={t("common.cancel")}
      submitLoading={busy}
      size="lg"
    >
      <CustomForm
        id="customer-form"
        className={formStackClass}
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
          <div className={formGridClass}>
            {CUSTOMER_FORM_FIELDS.map((f) => {
              if (f.type === "checkbox") {
                return (
                  <FormikSwitchField
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
                    className="sm:col-span-2"
                    placeholder={f.placeholderKey ? t(f.placeholderKey) : undefined}
                  />
                );
              }
              return (
                <FormikTextField
                  key={f.key}
                  name={f.key}
                  label={t(f.labelKey)}
                  type={
                    f.key === "credit_limit" ? "number" : f.type || "text"
                  }
                  required={
                    f.required ||
                    (f.key === "portal_password" &&
                      formValues.portal_enabled &&
                      !editing?.portal_enabled)
                  }
                  placeholder={
                    f.key === "portal_password" && editing?.portal_enabled
                      ? t("customers.portalPasswordHint")
                      : f.placeholderKey
                        ? t(f.placeholderKey)
                        : undefined
                  }
                  hint={f.hintKey ? t(f.hintKey) : undefined}
                />
              );
            })}
          </div>
        )}
      </CustomForm>
    </FormModal>
  );
}

type LoyaltyAdjustmentModalProps = {
  isOpen: boolean;
  busy: boolean;
  customerName: string;
  currentPoints: number;
  t: Translate;
  onClose: () => void;
  onSubmit: (values: { delta: number; reason: string }) => void | Promise<void>;
};

export function LoyaltyAdjustmentModal({
  isOpen,
  busy,
  customerName,
  currentPoints,
  t,
  onClose,
  onSubmit,
}: LoyaltyAdjustmentModalProps) {
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("customers.adjustPointsTitle", { name: customerName })}
      formId="loyalty-form"
      submitLabel={t("customers.apply")}
      cancelLabel={t("common.cancel")}
      submitLoading={busy}
    >
      <CustomForm
        id="loyalty-form"
        className={formStackClass}
        initialValues={{ delta: 10, reason: "" }}
        validationSchema={loyaltyAdjustSchema}
        onSubmit={async (vals) => {
          await onSubmit({ delta: Number(vals.delta), reason: vals.reason });
        }}
      >
        {() => (
          <div className={formStackClass}>
            <p className="text-sm text-body">
              {t("customers.currentPoints", { count: currentPoints })}
            </p>
            <div className={formGridClass}>
              <FormikTextField
                name="delta"
                label={t("customers.delta")}
                type="number"
                placeholder={t("customers.phDelta")}
              />
              <FormikTextField
                name="reason"
                label={t("customers.reason")}
                placeholder={t("customers.phReason")}
              />
            </div>
          </div>
        )}
      </CustomForm>
    </FormModal>
  );
}
