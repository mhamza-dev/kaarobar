import * as yup from "yup";
import type { CustomerForm } from "@/lib/customers";

export const customerFormSchema: yup.ObjectSchema<CustomerForm> = yup.object({
  name: yup.string().trim().required("Name is required").max(200),
  phone: yup.string().trim().default(""),
  email: yup
    .string()
    .trim()
    .email("Enter a valid email")
    .default(""),
  address: yup.string().trim().default(""),
  notes: yup.string().trim().default(""),
  cnic: yup.string().trim().default(""),
  ntn: yup.string().trim().default(""),
  company_name: yup.string().trim().default(""),
  credit_limit: yup.string().trim().default(""),
  user_id: yup.string().trim().default(""),
  credit_enabled: yup.boolean().default(true),
  marketing_opt_in_email: yup.boolean().default(false),
  marketing_opt_in_sms: yup.boolean().default(false),
  marketing_opt_in_whatsapp: yup.boolean().default(false),
  portal_enabled: yup.boolean().default(false),
  portal_password: yup.string().default(""),
});

export const loyaltyAdjustSchema = yup.object({
  delta: yup
    .number()
    .typeError("Enter a number")
    .required("Delta is required"),
  reason: yup.string().trim().default(""),
});

export const receiveArPaymentSchema = yup.object({
  invoiceId: yup.string().required("Select an invoice"),
  amount: yup
    .string()
    .trim()
    .required("Amount is required")
    .test("positive", "Amount must be greater than 0", (v) => Number(v) > 0),
  method: yup
    .mixed<"cash" | "bank" | "card" | "wallet">()
    .oneOf(["cash", "bank", "card", "wallet"])
    .required(),
  reference: yup.string().trim().default(""),
});
