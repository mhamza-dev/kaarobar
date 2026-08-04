"use client";

import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import type { FormEvent } from "react";

export type SupplierFormState = {
  name: string;
  legal_name: string;
  code: string;
  tax_id: string;
  strn: string;
  website: string;
  industry: string;
  status: string;
  notes: string;
  is_preferred: boolean;
  rating: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  contact_mobile: string;
  contact_whatsapp: string;
  contact_cnic: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  payment_terms: string;
  payment_method: string;
  bank_name: string;
  bank_iban: string;
  bank_account_title: string;
  credit_limit: string;
  currency: string;
  lead_time_days: string;
  minimum_order_amount: string;
  tags: string;
};

type SupplierFormModalProps = {
  isOpen: boolean;
  editingSupplierId: string | null;
  supplierForm: SupplierFormState;
  setSupplierForm: (next: SupplierFormState) => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
};

export default function SupplierFormModal({
  isOpen,
  editingSupplierId,
  supplierForm,
  setSupplierForm,
  busy,
  onClose,
  onSubmit,
}: SupplierFormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSupplierId ? "Edit supplier" : "Add supplier"}
      description="Company details, liaison contact, address, and payment terms."
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-modal-form" loading={busy}>
            {editingSupplierId ? "Save changes" : "Add supplier"}
          </Button>
        </div>
      }
    >
      <form id="supplier-modal-form" onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Company</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Trade name">
              <input
                className={fieldClass}
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Legal name">
              <input
                className={fieldClass}
                value={supplierForm.legal_name}
                onChange={(e) => setSupplierForm({ ...supplierForm, legal_name: e.target.value })}
              />
            </Field>
            <Field label="Supplier code">
              <input
                className={fieldClass}
                value={supplierForm.code}
                onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                placeholder="e.g. LHR-DIST"
              />
            </Field>
            <Field label="Industry">
              <input
                className={fieldClass}
                value={supplierForm.industry}
                onChange={(e) => setSupplierForm({ ...supplierForm, industry: e.target.value })}
                placeholder="FMCG wholesale"
              />
            </Field>
            <Field label="NTN / Tax ID">
              <input
                className={fieldClass}
                value={supplierForm.tax_id}
                onChange={(e) => setSupplierForm({ ...supplierForm, tax_id: e.target.value })}
              />
            </Field>
            <Field label="STRN">
              <input
                className={fieldClass}
                value={supplierForm.strn}
                onChange={(e) => setSupplierForm({ ...supplierForm, strn: e.target.value })}
              />
            </Field>
            <Field label="Website">
              <input
                className={fieldClass}
                value={supplierForm.website}
                onChange={(e) => setSupplierForm({ ...supplierForm, website: e.target.value })}
                placeholder="https://"
              />
            </Field>
            <Field label="Status">
              <Select
                value={supplierForm.status}
                onChange={(v) => setSupplierForm({ ...supplierForm, status: v })}
                options={["active", "inactive", "blocked", "pending"].map((s) => ({
                  value: s,
                  label: s,
                }))}
              />
            </Field>
            <Field label="Rating (1–5)">
              <input
                className={fieldClass}
                type="number"
                min={1}
                max={5}
                value={supplierForm.rating}
                onChange={(e) => setSupplierForm({ ...supplierForm, rating: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 pt-7 text-sm text-heading">
              <input
                type="checkbox"
                checked={supplierForm.is_preferred}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, is_preferred: e.target.checked })
                }
              />
              Preferred supplier
            </label>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Primary contact</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person name">
              <input className={fieldClass} value={supplierForm.contact_name} onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} />
            </Field>
            <Field label="Role / title">
              <input className={fieldClass} value={supplierForm.contact_role} onChange={(e) => setSupplierForm({ ...supplierForm, contact_role: e.target.value })} placeholder="Key Account Manager" />
            </Field>
            <Field label="Email">
              <input type="email" className={fieldClass} value={supplierForm.contact_email} onChange={(e) => setSupplierForm({ ...supplierForm, contact_email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={fieldClass} value={supplierForm.contact_phone} onChange={(e) => setSupplierForm({ ...supplierForm, contact_phone: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <input className={fieldClass} value={supplierForm.contact_mobile} onChange={(e) => setSupplierForm({ ...supplierForm, contact_mobile: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <input className={fieldClass} value={supplierForm.contact_whatsapp} onChange={(e) => setSupplierForm({ ...supplierForm, contact_whatsapp: e.target.value })} />
            </Field>
            <Field label="CNIC">
              <input className={fieldClass} value={supplierForm.contact_cnic} onChange={(e) => setSupplierForm({ ...supplierForm, contact_cnic: e.target.value })} />
            </Field>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Address</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address line 1"><input className={fieldClass} value={supplierForm.address_line1} onChange={(e) => setSupplierForm({ ...supplierForm, address_line1: e.target.value })} /></Field>
            <Field label="Address line 2"><input className={fieldClass} value={supplierForm.address_line2} onChange={(e) => setSupplierForm({ ...supplierForm, address_line2: e.target.value })} /></Field>
            <Field label="City"><input className={fieldClass} value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} /></Field>
            <Field label="Province"><input className={fieldClass} value={supplierForm.province} onChange={(e) => setSupplierForm({ ...supplierForm, province: e.target.value })} /></Field>
            <Field label="Postal code"><input className={fieldClass} value={supplierForm.postal_code} onChange={(e) => setSupplierForm({ ...supplierForm, postal_code: e.target.value })} /></Field>
            <Field label="Country"><input className={fieldClass} value={supplierForm.country} onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })} /></Field>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Payment & credit</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Payment terms"><input className={fieldClass} value={supplierForm.payment_terms} onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })} placeholder="Net 30" /></Field>
            <Field label="Payment method">
              <Select
                value={supplierForm.payment_method}
                onChange={(v) => setSupplierForm({ ...supplierForm, payment_method: v })}
                options={["bank_transfer", "cash", "cheque", "wallet", "credit"].map((m) => ({
                  value: m,
                  label: m.replace("_", " "),
                }))}
              />
            </Field>
            <Field label="Bank name"><input className={fieldClass} value={supplierForm.bank_name} onChange={(e) => setSupplierForm({ ...supplierForm, bank_name: e.target.value })} /></Field>
            <Field label="IBAN"><input className={fieldClass} value={supplierForm.bank_iban} onChange={(e) => setSupplierForm({ ...supplierForm, bank_iban: e.target.value })} /></Field>
            <Field label="Account title"><input className={fieldClass} value={supplierForm.bank_account_title} onChange={(e) => setSupplierForm({ ...supplierForm, bank_account_title: e.target.value })} /></Field>
            <Field label="Credit limit">
              <input
                className={fieldClass}
                type="number"
                step="0.01"
                value={supplierForm.credit_limit}
                onChange={(e) => setSupplierForm({ ...supplierForm, credit_limit: e.target.value })}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") return;
                  setSupplierForm({ ...supplierForm, credit_limit: formatDecimal(e.target.value) });
                }}
              />
            </Field>
            <Field label="Currency"><input className={fieldClass} value={supplierForm.currency} onChange={(e) => setSupplierForm({ ...supplierForm, currency: e.target.value })} /></Field>
            <Field label="Lead time (days)"><input className={fieldClass} type="number" min={0} value={supplierForm.lead_time_days} onChange={(e) => setSupplierForm({ ...supplierForm, lead_time_days: e.target.value })} /></Field>
            <Field label="Minimum order amount">
              <input
                className={fieldClass}
                type="number"
                step="0.01"
                value={supplierForm.minimum_order_amount}
                onChange={(e) => setSupplierForm({ ...supplierForm, minimum_order_amount: e.target.value })}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") return;
                  setSupplierForm({
                    ...supplierForm,
                    minimum_order_amount: formatDecimal(e.target.value),
                  });
                }}
              />
            </Field>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Notes & tags</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tags (comma-separated)">
              <input
                className={fieldClass}
                value={supplierForm.tags}
                onChange={(e) => setSupplierForm({ ...supplierForm, tags: e.target.value })}
                placeholder="preferred, fmcg"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              className={fieldClass}
              rows={3}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
            />
          </Field>
        </section>
      </form>
    </Modal>
  );
}
