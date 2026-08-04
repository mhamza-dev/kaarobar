import * as yup from "yup";

export type SaleLookupFormValues = {
  sale_id: string;
};

export const emptySaleLookupForm = (): SaleLookupFormValues => ({
  sale_id: "",
});

export const saleLookupFormSchema: yup.ObjectSchema<SaleLookupFormValues> =
  yup.object({
    sale_id: yup.string().trim().required("Sale ID is required"),
  });

export type ReturnSubmitFormValues = {
  refund_method: "cash" | "card" | "wallet";
  reason: string;
  quantities: Record<string, string>;
};

export const emptyReturnSubmitForm = (
  productIds: string[] = []
): ReturnSubmitFormValues => ({
  refund_method: "cash",
  reason: "",
  quantities: Object.fromEntries(productIds.map((id) => [id, ""])),
});

export const returnSubmitFormSchema: yup.ObjectSchema<ReturnSubmitFormValues> =
  yup.object({
    refund_method: yup
      .mixed<"cash" | "card" | "wallet">()
      .oneOf(["cash", "card", "wallet"])
      .required("Refund method is required"),
    reason: yup.string().trim().default(""),
    quantities: yup
      .object()
      .test(
        "at-least-one",
        "Enter a return quantity for at least one item",
        (value) => {
          if (!value || typeof value !== "object") return false;
          return Object.values(value as Record<string, string>).some(
            (q) => Number(q) > 0
          );
        }
      )
      .required(),
  });
