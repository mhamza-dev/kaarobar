import * as yup from "yup";
import type { CustomerForm } from "@core/lib/customers";

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
});

export const loyaltyAdjustSchema = yup.object({
  delta: yup
    .number()
    .typeError("Enter a number")
    .required("Delta is required"),
  reason: yup.string().trim().default(""),
});
