import * as yup from "yup";

export const bookableResourceFormSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
  kind: yup
    .string()
    .trim()
    .oneOf(["room", "chair", "equipment"], "Select a kind")
    .required("Kind is required"),
  capacity: yup.string().trim().default("1"),
  notes: yup.string().trim().default(""),
  is_active: yup.boolean().default(true),
});

export type BookableResourceFormValues = yup.InferType<
  typeof bookableResourceFormSchema
>;

export const emptyBookableResourceForm = (): BookableResourceFormValues => ({
  name: "",
  kind: "chair",
  capacity: "1",
  notes: "",
  is_active: true,
});

export const staffBookAppointmentSchema = yup.object({
  product_id: yup.string().trim().required("Service is required"),
  staff_id: yup.string().trim().required("Staff is required"),
  customer_id: yup.string().trim().default(""),
  starts_at: yup.string().trim().required("Start time is required"),
  bookable_resource_id: yup.string().trim().default(""),
  notes: yup.string().trim().max(500).default(""),
  package_purchase_id: yup.string().trim().default(""),
});

export type StaffBookAppointmentValues = yup.InferType<
  typeof staffBookAppointmentSchema
>;

export const emptyStaffBookAppointment = (): StaffBookAppointmentValues => ({
  product_id: "",
  staff_id: "",
  customer_id: "",
  starts_at: "",
  bookable_resource_id: "",
  notes: "",
  package_purchase_id: "",
});
