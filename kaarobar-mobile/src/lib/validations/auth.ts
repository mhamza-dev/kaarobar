import * as yup from "yup";

export type AuthMethod = "email" | "phone";

const email = yup.string().trim().email("Please enter a valid email address");

const phoneNumber = yup
  .string()
  .trim()
  .matches(/^\+?[1-9]\d{7,14}$/, "Please enter a valid phone number");

const password = yup
  .string()
  .required("Password is required")
  .min(8, "Password must be at least 8 characters")
  .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
  .matches(/[a-z]/, "Password must contain at least one lowercase letter")
  .matches(/[0-9]/, "Password must contain at least one number")
  .matches(
    /[!@#$%^&*(),.?":{}|<>]/,
    "Password must contain at least one special character",
  );

export const loginSchema = yup.object({
  loginMethod: yup.mixed<AuthMethod>().oneOf(["email", "phone"]).required(),

  email: email.when("loginMethod", {
    is: "email",
    then: (schema) => schema.required("Email address is required"),
    otherwise: (schema) => schema.notRequired(),
  }),

  phoneNumber: phoneNumber.when("loginMethod", {
    is: "phone",
    then: (schema) => schema.required("Phone number is required"),
    otherwise: (schema) => schema.notRequired(),
  }),

  password: yup.string().required("Password is required"),

  remember: yup.boolean().default(false),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

export const signupSchema = yup.object({
  signupMethod: yup.mixed<AuthMethod>().oneOf(["email", "phone"]).required(),

  fullName: yup
    .string()
    .trim()
    .required("Full name is required")
    .min(2)
    .max(100),

  businessName: yup
    .string()
    .trim()
    .required("Business name is required")
    .min(2)
    .max(100),

  email: email.when("signupMethod", {
    is: "email",
    then: (schema) => schema.required("Email address is required"),
    otherwise: (schema) => schema.notRequired(),
  }),

  phoneNumber: phoneNumber.when("signupMethod", {
    is: "phone",
    then: (schema) => schema.required("Phone number is required"),
    otherwise: (schema) => schema.notRequired(),
  }),

  password,

  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("password")], "Passwords do not match"),

  acceptTerms: yup
    .boolean()
    .oneOf([true], "You must accept the Terms & Conditions"),
});

export type SignupFormValues = yup.InferType<typeof signupSchema>;

export const profileFormSchema = yup.object({
  name: yup.string().trim().required("Name is required").max(100),
  email: yup.string().trim().email().default(""),
  phone: yup.string().trim().default(""),
  password: yup
    .string()
    .default("")
    .test(
      "password-optional",
      "Password must be at least 8 characters with upper, lower, number, and special",
      (value) => {
        if (!value || !value.trim()) return true;
        return password.isValidSync(value);
      }
    ),
});

export type ProfileFormValues = yup.InferType<typeof profileFormSchema>;

export const emptyProfileForm = (): ProfileFormValues => ({
  name: "",
  email: "",
  phone: "",
  password: "",
});
