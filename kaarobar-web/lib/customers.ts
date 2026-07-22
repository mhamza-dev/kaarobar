/** Shared customer field model for web / desktop / mobile. */

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  cnic?: string | null;
  ntn?: string | null;
  company_name?: string | null;
  credit_limit?: string | null;
  loyalty_points?: number;
  loyalty_tier_id?: string | null;
  khata_enabled?: boolean;
  marketing_opt_in_email?: boolean;
  marketing_opt_in_sms?: boolean;
  marketing_opt_in_whatsapp?: boolean;
  portal_enabled?: boolean;
  profile_pic_url?: string | null;
  user_id?: string | null;
  balance?: string | null;
};

export type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  cnic: string;
  ntn: string;
  company_name: string;
  credit_limit: string;
  user_id: string;
  khata_enabled: boolean;
  marketing_opt_in_email: boolean;
  marketing_opt_in_sms: boolean;
  marketing_opt_in_whatsapp: boolean;
};

export const emptyCustomerForm = (): CustomerForm => ({
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  cnic: "",
  ntn: "",
  company_name: "",
  credit_limit: "",
  user_id: "",
  khata_enabled: true,
  marketing_opt_in_email: false,
  marketing_opt_in_sms: false,
  marketing_opt_in_whatsapp: false,
});

export function customerToForm(c: Customer): CustomerForm {
  return {
    name: c.name || "",
    phone: c.phone || "",
    email: c.email || "",
    address: c.address || "",
    notes: c.notes || "",
    cnic: c.cnic || "",
    ntn: c.ntn || "",
    company_name: c.company_name || "",
    credit_limit: c.credit_limit || "",
    user_id: c.user_id || "",
    khata_enabled: c.khata_enabled === true,
    marketing_opt_in_email: c.marketing_opt_in_email === true,
    marketing_opt_in_sms: c.marketing_opt_in_sms === true,
    marketing_opt_in_whatsapp: c.marketing_opt_in_whatsapp === true,
  };
}

export function customerPayload(form: CustomerForm) {
  return {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    cnic: form.cnic.trim() || null,
    ntn: form.ntn.trim() || null,
    company_name: form.company_name.trim() || null,
    credit_limit: form.credit_limit.trim() || null,
    user_id: form.user_id.trim() || null,
    khata_enabled: form.khata_enabled,
    marketing_opt_in_email: form.marketing_opt_in_email,
    marketing_opt_in_sms: form.marketing_opt_in_sms,
    marketing_opt_in_whatsapp: form.marketing_opt_in_whatsapp,
  };
}

export function customerSearchText(c: Customer) {
  return [c.name, c.phone, c.email, c.company_name, c.cnic, c.ntn].filter(Boolean).join(" ");
}

export const CUSTOMER_FORM_FIELDS: {
  key: keyof CustomerForm;
  labelKey: string;
  required?: boolean;
  type?: "text" | "email" | "textarea" | "checkbox";
}[] = [
  { key: "name", labelKey: "common.name", required: true },
  { key: "company_name", labelKey: "customers.company" },
  { key: "phone", labelKey: "customers.phone" },
  { key: "email", labelKey: "customers.email", type: "email" },
  { key: "cnic", labelKey: "customers.cnic" },
  { key: "ntn", labelKey: "customers.ntn" },
  { key: "address", labelKey: "customers.address" },
  { key: "credit_limit", labelKey: "customers.creditLimit" },
  { key: "user_id", labelKey: "customers.userId" },
  { key: "notes", labelKey: "customers.notes", type: "textarea" },
  { key: "khata_enabled", labelKey: "customers.khataEnabled", type: "checkbox" },
  { key: "marketing_opt_in_email", labelKey: "customers.optInEmail", type: "checkbox" },
  { key: "marketing_opt_in_sms", labelKey: "customers.optInSms", type: "checkbox" },
  { key: "marketing_opt_in_whatsapp", labelKey: "customers.optInWhatsapp", type: "checkbox" },
];
