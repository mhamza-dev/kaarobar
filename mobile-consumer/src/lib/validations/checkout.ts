import * as yup from "yup";

export type CheckoutPayMethod = "card" | "wallet";

export const checkoutPaySchema = yup.object({
  contactName: yup
    .string()
    .trim()
    .required("Contact name is required for pickup"),
  phone: yup
    .string()
    .trim()
    .required("Phone is required for pickup")
    .min(7, "Enter a valid phone number"),
  pickupNotes: yup.string().trim().max(500).default(""),
  payMethod: yup
    .mixed<CheckoutPayMethod>()
    .oneOf(["card", "wallet"])
    .required(),
});

export type CheckoutPayValues = yup.InferType<typeof checkoutPaySchema>;

export const appointmentNotesSchema = yup.object({
  notes: yup.string().trim().max(500).default(""),
});

export type AppointmentNotesValues = yup.InferType<typeof appointmentNotesSchema>;
