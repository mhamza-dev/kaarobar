import * as yup from "yup";

export type ProfileFormValues = {
  name: string;
  phone: string;
  password: string;
};

export const emptyProfileForm = (): ProfileFormValues => ({
  name: "",
  phone: "",
  password: "",
});

export const profileFormSchema: yup.ObjectSchema<ProfileFormValues> = yup.object({
  name: yup.string().trim().required("Name is required").max(200),
  phone: yup.string().trim().default(""),
  password: yup
    .string()
    .default("")
    .test(
      "min-if-set",
      "Password must be at least 8 characters",
      (v) => !v || v.length === 0 || v.length >= 8
    ),
});
