"use client";

import { useState } from "react";
import { useField } from "formik";
import { api } from "@/lib/api/client";
import FormModal from "@/components/app/FormModal";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
} from "@/components/ui/FormFields";
import {
  Field,
  fieldClass,
  formGridClass,
  formSectionTitleClass,
  formStackClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import {
  supplierFormSchema,
  type SupplierFormValues,
} from "@/lib/validations/products";

export type SupplierFormSupplier = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  code?: string | null;
  tax_id?: string | null;
  strn?: string | null;
  website?: string | null;
  industry?: string | null;
  status?: string | null;
  notes?: string | null;
  is_preferred?: boolean | null;
  rating?: number | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_mobile?: string | null;
  contact_whatsapp?: string | null;
  contact_cnic?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  payment_terms?: string | null;
  payment_method?: string | null;
  bank_name?: string | null;
  bank_iban?: string | null;
  bank_account_title?: string | null;
  credit_limit?: string | null;
  currency?: string | null;
  lead_time_days?: number | null;
  minimum_order_amount?: string | null;
  tags?: string[] | null;
};

/** @deprecated Prefer SupplierFormValues from validations/products */
export type SupplierFormState = SupplierFormValues;

const emptyForm: SupplierFormValues = {
  name: "",
  legal_name: "",
  code: "",
  tax_id: "",
  strn: "",
  website: "",
  industry: "",
  status: "active",
  notes: "",
  is_preferred: false,
  rating: "",
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  contact_mobile: "",
  contact_whatsapp: "",
  contact_cnic: "",
  address_line1: "",
  address_line2: "",
  city: "",
  province: "",
  postal_code: "",
  country: "PK",
  payment_terms: "Net 30",
  payment_method: "bank_transfer",
  bank_name: "",
  bank_iban: "",
  bank_account_title: "",
  credit_limit: "",
  currency: "PKR",
  lead_time_days: "",
  minimum_order_amount: "",
  tags: "",
};

function toFormState(
  supplier?: SupplierFormSupplier | null
): SupplierFormValues {
  if (!supplier) return emptyForm;
  return {
    name: supplier.name || "",
    legal_name: supplier.legal_name || "",
    code: supplier.code || "",
    tax_id: supplier.tax_id || "",
    strn: supplier.strn || "",
    website: supplier.website || "",
    industry: supplier.industry || "",
    status: supplier.status || "active",
    notes: supplier.notes || "",
    is_preferred: Boolean(supplier.is_preferred),
    rating: supplier.rating != null ? String(supplier.rating) : "",
    contact_name: supplier.contact_name || "",
    contact_role: supplier.contact_role || "",
    contact_email: supplier.contact_email || "",
    contact_phone: supplier.contact_phone || "",
    contact_mobile: supplier.contact_mobile || "",
    contact_whatsapp: supplier.contact_whatsapp || "",
    contact_cnic: supplier.contact_cnic || "",
    address_line1: supplier.address_line1 || "",
    address_line2: supplier.address_line2 || "",
    city: supplier.city || "",
    province: supplier.province || "",
    postal_code: supplier.postal_code || "",
    country: supplier.country || "PK",
    payment_terms: supplier.payment_terms || "Net 30",
    payment_method: supplier.payment_method || "bank_transfer",
    bank_name: supplier.bank_name || "",
    bank_iban: supplier.bank_iban || "",
    bank_account_title: supplier.bank_account_title || "",
    credit_limit: supplier.credit_limit || "",
    currency: supplier.currency || "PKR",
    lead_time_days:
      supplier.lead_time_days != null ? String(supplier.lead_time_days) : "",
    minimum_order_amount: supplier.minimum_order_amount || "",
    tags: (supplier.tags || []).join(", "),
  };
}

function supplierPayload(values: SupplierFormValues) {
  const splitList = (v: string) =>
    v
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean);

  return {
    name: values.name.trim(),
    legal_name: values.legal_name.trim() || null,
    code: values.code.trim() || null,
    tax_id: values.tax_id.trim() || null,
    strn: values.strn.trim() || null,
    website: values.website.trim() || null,
    industry: values.industry.trim() || null,
    status: values.status,
    notes: values.notes.trim() || null,
    is_preferred: values.is_preferred,
    rating: values.rating ? Number(values.rating) : null,
    contact_name: values.contact_name.trim() || null,
    contact_role: values.contact_role.trim() || null,
    contact_email: values.contact_email.trim() || null,
    contact_phone: values.contact_phone.trim() || null,
    contact_mobile: values.contact_mobile.trim() || null,
    contact_whatsapp: values.contact_whatsapp.trim() || null,
    contact_cnic: values.contact_cnic.trim() || null,
    address_line1: values.address_line1.trim() || null,
    address_line2: values.address_line2.trim() || null,
    city: values.city.trim() || null,
    province: values.province.trim() || null,
    postal_code: values.postal_code.trim() || null,
    country: values.country.trim() || "PK",
    payment_terms: values.payment_terms.trim() || null,
    payment_method: values.payment_method || null,
    bank_name: values.bank_name.trim() || null,
    bank_iban: values.bank_iban.trim() || null,
    bank_account_title: values.bank_account_title.trim() || null,
    credit_limit: values.credit_limit.trim() || null,
    currency: values.currency.trim() || "PKR",
    lead_time_days: values.lead_time_days
      ? Number(values.lead_time_days)
      : null,
    minimum_order_amount: values.minimum_order_amount.trim() || null,
    tags: splitList(values.tags),
    contact: {
      phone: values.contact_phone.trim() || null,
      email: values.contact_email.trim() || null,
    },
  };
}

function FormikDecimalField({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <div>
      <Field label={label}>
        <input
          {...field}
          type="number"
          step="0.01"
          className={fieldClass}
          onBlur={(e) => {
            field.onBlur(e);
            if (e.target.value.trim() === "") return;
            void helpers.setValue(formatDecimal(e.target.value));
          }}
        />
      </Field>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** When set, modal edits this supplier; otherwise creates. */
  supplier?: SupplierFormSupplier | null;
  onSuccess?: () => void | Promise<void>;
};

export default function SupplierFormModal({
  isOpen,
  onClose,
  supplier = null,
  onSuccess,
}: Props) {
  const t = useT();
  const toast = useToast();
  const editing = !!supplier?.id;
  const [busy, setBusy] = useState(false);

  async function handleSubmit(values: SupplierFormValues) {
    setBusy(true);
    try {
      const body = supplierPayload(values);
      if (editing) {
        await api(`/suppliers/${supplier!.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success(t("inventory.supplierUpdated"));
      } else {
        await api("/suppliers", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success(t("inventory.supplierAdded"));
      }
      onClose();
      await onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("inventory.supplierFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit supplier" : "Add supplier"}
      description="Company details, liaison contact, address, and payment terms."
      size="xl"
      formId="supplier-modal-form"
      submitLabel={editing ? "Save changes" : "Add supplier"}
      cancelLabel={t("common.cancel")}
      submitLoading={busy}
    >
      <CustomForm<SupplierFormValues>
        id="supplier-modal-form"
        className={formStackClass}
        initialValues={toFormState(supplier)}
        validationSchema={supplierFormSchema}
        enableReinitialize
        onSubmit={handleSubmit}
      >
        {() => (
          <div className={formStackClass}>
            <section className={formStackClass}>
              <h3 className={formSectionTitleClass}>Company</h3>
              <div className={formGridClass}>
                <FormikTextField name="name" label="Trade name" required />
                <FormikTextField name="legal_name" label="Legal name" />
                <FormikTextField
                  name="code"
                  label="Supplier code"
                  placeholder="e.g. LHR-DIST"
                />
                <FormikTextField
                  name="industry"
                  label="Industry"
                  placeholder="FMCG wholesale"
                />
                <FormikTextField name="tax_id" label="NTN / Tax ID" />
                <FormikTextField name="strn" label="STRN" />
                <FormikTextField
                  name="website"
                  label="Website"
                  placeholder="https://"
                />
                <FormikSelectField
                  name="status"
                  label="Status"
                  options={["active", "inactive", "blocked", "pending"].map(
                    (s) => ({ value: s, label: s })
                  )}
                />
                <FormikTextField
                  name="rating"
                  label="Rating (1–5)"
                  type="number"
                />
                <FormikSwitchField
                  name="is_preferred"
                  label="Preferred supplier"
                />
              </div>
            </section>
            <section className={formStackClass}>
              <h3 className={formSectionTitleClass}>Primary contact</h3>
              <div className={formGridClass}>
                <FormikTextField name="contact_name" label="Person name" />
                <FormikTextField
                  name="contact_role"
                  label="Role / title"
                  placeholder="Key Account Manager"
                />
                <FormikTextField
                  name="contact_email"
                  label="Email"
                  type="email"
                />
                <FormikTextField name="contact_phone" label="Phone" />
                <FormikTextField name="contact_mobile" label="Mobile" />
                <FormikTextField name="contact_whatsapp" label="WhatsApp" />
                <FormikTextField name="contact_cnic" label="CNIC" />
              </div>
            </section>
            <section className={formStackClass}>
              <h3 className={formSectionTitleClass}>Address</h3>
              <div className={formGridClass}>
                <FormikTextField name="address_line1" label="Address line 1" />
                <FormikTextField name="address_line2" label="Address line 2" />
                <FormikTextField name="city" label="City" />
                <FormikTextField name="province" label="Province" />
                <FormikTextField name="postal_code" label="Postal code" />
                <FormikTextField name="country" label="Country" />
              </div>
            </section>
            <section className={formStackClass}>
              <h3 className={formSectionTitleClass}>Payment & credit</h3>
              <div className={formGridClass}>
                <FormikTextField
                  name="payment_terms"
                  label="Payment terms"
                  placeholder="Net 30"
                />
                <FormikSelectField
                  name="payment_method"
                  label="Payment method"
                  options={[
                    "bank_transfer",
                    "cash",
                    "cheque",
                    "wallet",
                    "credit",
                  ].map((m) => ({
                    value: m,
                    label: m.replace("_", " "),
                  }))}
                />
                <FormikTextField name="bank_name" label="Bank name" />
                <FormikTextField name="bank_iban" label="IBAN" />
                <FormikTextField
                  name="bank_account_title"
                  label="Account title"
                />
                <FormikDecimalField name="credit_limit" label="Credit limit" />
                <FormikTextField name="currency" label="Currency" />
                <FormikTextField
                  name="lead_time_days"
                  label="Lead time (days)"
                  type="number"
                />
                <FormikDecimalField
                  name="minimum_order_amount"
                  label="Minimum order amount"
                />
              </div>
            </section>
            <section className={formStackClass}>
              <h3 className={formSectionTitleClass}>Notes & tags</h3>
              <div className={formGridClass}>
                <FormikTextField
                  name="tags"
                  label="Tags (comma-separated)"
                  placeholder="preferred, fmcg"
                  className="sm:col-span-2"
                />
              </div>
              <FormikTextField name="notes" label="Notes" type="textarea" />
            </section>
          </div>
        )}
      </CustomForm>
    </FormModal>
  );
}
