import * as yup from "yup";

export type ReturnFormValues = {
  reason: string;
  refund_method: "cash" | "card" | "wallet";
  quantities: Record<string, string>;
};

export const emptyReturnForm = (): ReturnFormValues => ({
  reason: "",
  refund_method: "cash",
  quantities: {},
});

export const returnFormSchema: yup.ObjectSchema<ReturnFormValues> = yup
  .object({
    reason: yup.string().trim().default(""),
    refund_method: yup
      .mixed<"cash" | "card" | "wallet">()
      .oneOf(["cash", "card", "wallet"])
      .required("Refund method is required"),
    quantities: yup.mixed<Record<string, string>>().default({}),
  })
  .test(
    "qty-positive",
    "Enter at least one return quantity",
    (values) => {
      const qtys = values?.quantities || {};
      return Object.values(qtys).some((q) => Number(q || "0") > 0);
    }
  );

export type SaleLookupFormValues = {
  sale_id: string;
};

export const saleLookupFormSchema: yup.ObjectSchema<SaleLookupFormValues> =
  yup.object({
    sale_id: yup.string().trim().required("Sale ID is required"),
  });
