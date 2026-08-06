import * as yup from "yup";

const email = yup.string().trim().email("Please enter a valid email address");

const password = yup
  .string()
  .required("Password is required")
  .min(8, "Password must be at least 8 characters");

export const consumerLoginSchema = yup.object({
  email: email.required("Email address is required"),
  password: yup.string().required("Password is required"),
});

export type ConsumerLoginValues = yup.InferType<typeof consumerLoginSchema>;

/** Owner signup surfaced in the customer app landing flow. */
export const ownerSignupSchema = yup.object({
  name: yup.string().trim().required("Full name is required").min(2).max(100),
  businessName: yup
    .string()
    .trim()
    .required("Business name is required")
    .min(2)
    .max(100),
  email: email.required("Email address is required"),
  password,
});

export type OwnerSignupValues = yup.InferType<typeof ownerSignupSchema>;
