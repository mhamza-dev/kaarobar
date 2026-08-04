"use client";

import { useMemo } from "react";
import FormModal from "@/components/app/FormModal";
import { Field, formGridClass, formStackClass } from "@/components/app/ui";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import Select from "@/components/ui/Select";
import { formatDecimal } from "@/lib/decimal";
import { receiveArPaymentSchema } from "@/lib/validations/customers";

export type OpenArInvoice = {
  id: string;
  invoice_number?: string;
  balance_due: string;
  status?: string;
  customer_id?: string;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

const METHODS = ["cash", "bank", "card", "wallet"] as const;

type ReceiveArPaymentValues = {
  invoiceId: string;
  amount: string;
  method: "cash" | "bank" | "card" | "wallet";
  reference: string;
};

export default function ReceiveArPaymentFormModal({
  isOpen,
  busy,
  invoices,
  t,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  busy: boolean;
  invoices: OpenArInvoice[];
  t: Translate;
  onClose: () => void;
  onSubmit: (payload: {
    invoiceId: string;
    amount: string;
    method: string;
    reference: string;
  }) => void | Promise<void>;
}) {
  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          Number(inv.balance_due) > 0 &&
          (!inv.status || inv.status === "open" || inv.status === "partial")
      ),
    [invoices]
  );

  const first = openInvoices[0];
  const initialValues: ReceiveArPaymentValues = {
    invoiceId: first?.id || "",
    amount: first?.balance_due ? formatDecimal(first.balance_due) : "",
    method: "cash",
    reference: "",
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("customers.receivePayment")}
      description={t("customers.receivePaymentDesc")}
      formId="receive-ar-payment-form"
      submitLabel={t("customers.receivePayment")}
      cancelLabel={t("common.cancel")}
      submitLoading={busy}
      submitDisabled={openInvoices.length === 0}
    >
      {openInvoices.length === 0 ? (
        <p className="text-sm text-body">{t("customers.noOpenInvoices")}</p>
      ) : (
        <CustomForm
          id="receive-ar-payment-form"
          className={formStackClass}
          initialValues={initialValues}
          validationSchema={receiveArPaymentSchema}
          onSubmit={async (values) => {
            const amount = values.amount.trim()
              ? formatDecimal(values.amount)
              : values.amount;
            await onSubmit({
              invoiceId: values.invoiceId,
              amount,
              method: values.method,
              reference: values.reference,
            });
          }}
        >
          {({ values, setFieldValue, errors, touched }) => (
            <div className={formStackClass}>
              <div>
                <Field label={t("customers.invoice")}>
                  <Select
                    value={values.invoiceId}
                    onChange={(id) => {
                      void setFieldValue("invoiceId", id);
                      const inv = openInvoices.find((i) => i.id === id);
                      if (inv?.balance_due) {
                        void setFieldValue("amount", formatDecimal(inv.balance_due));
                      }
                    }}
                    options={openInvoices.map((inv) => ({
                      value: inv.id,
                      label: `${inv.invoice_number || inv.id.slice(0, 8)} · ${formatDecimal(inv.balance_due)}`,
                    }))}
                  />
                </Field>
                {touched.invoiceId && errors.invoiceId ? (
                  <p className="mt-1 text-xs text-danger">{errors.invoiceId}</p>
                ) : null}
              </div>
              <div className={formGridClass}>
                <FormikTextField
                  name="amount"
                  label={t("common.amount")}
                  type="number"
                  required
                />
                <FormikSelectField
                  name="method"
                  label={t("customers.paymentMethod")}
                  options={METHODS.map((m) => ({
                    value: m,
                    label: t(`customers.method.${m}`),
                  }))}
                />
              </div>
              <FormikTextField
                name="reference"
                label={t("customers.paymentReference")}
                placeholder={t("customers.paymentReferenceHint")}
              />
            </div>
          )}
        </CustomForm>
      )}
    </FormModal>
  );
}
