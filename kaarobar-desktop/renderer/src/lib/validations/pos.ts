import * as yup from "yup";

export type PosNewCustomerFormValues = {
  name: string;
  phone: string;
};

export const emptyPosNewCustomerForm = (): PosNewCustomerFormValues => ({
  name: "",
  phone: "",
});

export const posNewCustomerFormSchema: yup.ObjectSchema<PosNewCustomerFormValues> =
  yup.object({
    name: yup.string().trim().required("Customer name is required").max(200),
    phone: yup.string().trim().default(""),
  });

export type OpenTillFormValues = {
  opening_cash: string;
};

export const emptyOpenTillForm = (): OpenTillFormValues => ({
  opening_cash: "0",
});

export const openTillFormSchema: yup.ObjectSchema<OpenTillFormValues> = yup.object(
  {
    opening_cash: yup.string().trim().default("0"),
  }
);

export type CloseTillFormValues = {
  closing_cash: string;
};

export const emptyCloseTillForm = (): CloseTillFormValues => ({
  closing_cash: "",
});

export const closeTillFormSchema: yup.ObjectSchema<CloseTillFormValues> =
  yup.object({
    closing_cash: yup.string().trim().default(""),
  });
