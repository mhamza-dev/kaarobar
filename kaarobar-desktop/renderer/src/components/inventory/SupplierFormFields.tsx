import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";

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

type Props = {
  form: SupplierFormState;
  onChange: (next: SupplierFormState) => void;
};

export default function SupplierFormFields({ form, onChange }: Props) {
  return (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Company</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trade name"><input className={fieldClass} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} required /></Field>
          <Field label="Legal name"><input className={fieldClass} value={form.legal_name} onChange={(e) => onChange({ ...form, legal_name: e.target.value })} /></Field>
          <Field label="Supplier code"><input className={fieldClass} value={form.code} onChange={(e) => onChange({ ...form, code: e.target.value })} placeholder="e.g. LHR-DIST" /></Field>
          <Field label="Industry"><input className={fieldClass} value={form.industry} onChange={(e) => onChange({ ...form, industry: e.target.value })} placeholder="FMCG wholesale" /></Field>
          <Field label="NTN / Tax ID"><input className={fieldClass} value={form.tax_id} onChange={(e) => onChange({ ...form, tax_id: e.target.value })} /></Field>
          <Field label="STRN"><input className={fieldClass} value={form.strn} onChange={(e) => onChange({ ...form, strn: e.target.value })} /></Field>
          <Field label="Website"><input className={fieldClass} value={form.website} onChange={(e) => onChange({ ...form, website: e.target.value })} placeholder="https://" /></Field>
          <Field label="Status"><Select value={form.status} onChange={(v) => onChange({ ...form, status: v })} options={["active", "inactive", "blocked", "pending"].map((s) => ({ value: s, label: s }))} triggerClassName="border-border bg-bg-secondary/80" /></Field>
          <Field label="Rating (1–5)"><input className={fieldClass} type="number" min={1} max={5} value={form.rating} onChange={(e) => onChange({ ...form, rating: e.target.value })} /></Field>
          <label className="flex items-center gap-2 pt-7 text-sm text-heading"><input type="checkbox" checked={form.is_preferred} onChange={(e) => onChange({ ...form, is_preferred: e.target.checked })} />Preferred supplier</label>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Primary contact</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Person name"><input className={fieldClass} value={form.contact_name} onChange={(e) => onChange({ ...form, contact_name: e.target.value })} /></Field>
          <Field label="Role / title"><input className={fieldClass} value={form.contact_role} onChange={(e) => onChange({ ...form, contact_role: e.target.value })} placeholder="Key Account Manager" /></Field>
          <Field label="Email"><input type="email" className={fieldClass} value={form.contact_email} onChange={(e) => onChange({ ...form, contact_email: e.target.value })} /></Field>
          <Field label="Phone"><input className={fieldClass} value={form.contact_phone} onChange={(e) => onChange({ ...form, contact_phone: e.target.value })} /></Field>
          <Field label="Mobile"><input className={fieldClass} value={form.contact_mobile} onChange={(e) => onChange({ ...form, contact_mobile: e.target.value })} /></Field>
          <Field label="WhatsApp"><input className={fieldClass} value={form.contact_whatsapp} onChange={(e) => onChange({ ...form, contact_whatsapp: e.target.value })} /></Field>
          <Field label="CNIC"><input className={fieldClass} value={form.contact_cnic} onChange={(e) => onChange({ ...form, contact_cnic: e.target.value })} /></Field>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Address</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address line 1"><input className={fieldClass} value={form.address_line1} onChange={(e) => onChange({ ...form, address_line1: e.target.value })} /></Field>
          <Field label="Address line 2"><input className={fieldClass} value={form.address_line2} onChange={(e) => onChange({ ...form, address_line2: e.target.value })} /></Field>
          <Field label="City"><input className={fieldClass} value={form.city} onChange={(e) => onChange({ ...form, city: e.target.value })} /></Field>
          <Field label="Province"><input className={fieldClass} value={form.province} onChange={(e) => onChange({ ...form, province: e.target.value })} /></Field>
          <Field label="Postal code"><input className={fieldClass} value={form.postal_code} onChange={(e) => onChange({ ...form, postal_code: e.target.value })} /></Field>
          <Field label="Country"><input className={fieldClass} value={form.country} onChange={(e) => onChange({ ...form, country: e.target.value })} /></Field>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Payment & credit</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment terms"><input className={fieldClass} value={form.payment_terms} onChange={(e) => onChange({ ...form, payment_terms: e.target.value })} placeholder="Net 30" /></Field>
          <Field label="Payment method"><Select value={form.payment_method} onChange={(v) => onChange({ ...form, payment_method: v })} options={["bank_transfer", "cash", "cheque", "wallet", "credit"].map((m) => ({ value: m, label: m.replace("_", " ") }))} triggerClassName="border-border bg-bg-secondary/80" /></Field>
          <Field label="Bank name"><input className={fieldClass} value={form.bank_name} onChange={(e) => onChange({ ...form, bank_name: e.target.value })} /></Field>
          <Field label="IBAN"><input className={fieldClass} value={form.bank_iban} onChange={(e) => onChange({ ...form, bank_iban: e.target.value })} /></Field>
          <Field label="Account title"><input className={fieldClass} value={form.bank_account_title} onChange={(e) => onChange({ ...form, bank_account_title: e.target.value })} /></Field>
          <Field label="Credit limit"><input className={fieldClass} type="number" step="0.01" min={0} value={form.credit_limit} onChange={(e) => onChange({ ...form, credit_limit: e.target.value })} onBlur={() => { if (!form.credit_limit.trim()) return; onChange({ ...form, credit_limit: formatDecimal(form.credit_limit) }); }} /></Field>
          <Field label="Currency"><input className={fieldClass} value={form.currency} onChange={(e) => onChange({ ...form, currency: e.target.value })} /></Field>
          <Field label="Lead time (days)"><input className={fieldClass} type="number" min={0} value={form.lead_time_days} onChange={(e) => onChange({ ...form, lead_time_days: e.target.value })} /></Field>
          <Field label="Minimum order amount"><input className={fieldClass} type="number" step="0.01" min={0} value={form.minimum_order_amount} onChange={(e) => onChange({ ...form, minimum_order_amount: e.target.value })} onBlur={() => { if (!form.minimum_order_amount.trim()) return; onChange({ ...form, minimum_order_amount: formatDecimal(form.minimum_order_amount) }); }} /></Field>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Tags & notes</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tags (comma-separated)"><input className={fieldClass} value={form.tags} onChange={(e) => onChange({ ...form, tags: e.target.value })} placeholder="preferred, fmcg" /></Field>
        </div>
        <Field label="Notes"><textarea className={fieldClass} rows={3} value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} /></Field>
      </section>
    </>
  );
}
