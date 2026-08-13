import * as yup from "yup";

export const productFormSchema = yup.object({
  sku: yup.string().trim().required("SKU is required"),
  name: yup.string().trim().required("Name is required"),
  price: yup.string().trim().required("Price is required"),
  barcode: yup.string().trim().default(""),
  brand: yup.string().trim().default(""),
  unit: yup.string().trim().required("Unit is required"),
  product_kind: yup.string().trim().required("Kind is required"),
  duration_minutes: yup.string().trim().default(""),
  category: yup.string().trim().default(""),
  category_id: yup.string().trim().default(""),
});

export type ProductFormValues = yup.InferType<typeof productFormSchema>;

export const emptyProductForm = (): ProductFormValues => ({
  sku: "",
  name: "",
  price: "",
  barcode: "",
  brand: "",
  unit: "pcs",
  product_kind: "goods",
  duration_minutes: "",
  category: "",
  category_id: "",
});

export const supplierFormSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
  legal_name: yup.string().trim().default(""),
  code: yup.string().trim().default(""),
  tax_id: yup.string().trim().default(""),
  strn: yup.string().trim().default(""),
  website: yup.string().trim().default(""),
  industry: yup.string().trim().default(""),
  status: yup.string().trim().default("active"),
  notes: yup.string().trim().default(""),
  is_preferred: yup.boolean().default(false),
  rating: yup.string().trim().default(""),
  contact_name: yup.string().trim().default(""),
  contact_role: yup.string().trim().default(""),
  contact_email: yup
    .string()
    .trim()
    .default("")
    .test(
      "email",
      "Enter a valid email",
      (value) => !value || yup.string().email().isValidSync(value)
    ),
  contact_phone: yup.string().trim().default(""),
  contact_mobile: yup.string().trim().default(""),
  contact_whatsapp: yup.string().trim().default(""),
  contact_cnic: yup.string().trim().default(""),
  address_line1: yup.string().trim().default(""),
  address_line2: yup.string().trim().default(""),
  city: yup.string().trim().default(""),
  province: yup.string().trim().default(""),
  postal_code: yup.string().trim().default(""),
  country: yup.string().trim().default("PK"),
  payment_terms: yup.string().trim().default("Net 30"),
  payment_method: yup.string().trim().default("bank_transfer"),
  bank_name: yup.string().trim().default(""),
  bank_iban: yup.string().trim().default(""),
  bank_account_title: yup.string().trim().default(""),
  credit_limit: yup.string().trim().default(""),
  currency: yup.string().trim().default("PKR"),
  lead_time_days: yup.string().trim().default(""),
  minimum_order_amount: yup.string().trim().default(""),
  tags: yup.string().trim().default(""),
});

export type SupplierFormValues = yup.InferType<typeof supplierFormSchema>;

export const emptySupplierForm = (): SupplierFormValues => ({
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
});
