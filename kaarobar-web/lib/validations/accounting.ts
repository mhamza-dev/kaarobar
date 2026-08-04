import * as yup from "yup";

export type AccountFormValues = {
  code: string;
  name: string;
  type: string;
  parent_account_id: string;
  classification: string;
  normal_balance: string;
  is_header: boolean;
};

export type JournalLineValues = {
  account_id: string;
  debit: string;
  credit: string;
};

export type JournalEntryFormValues = {
  description: string;
  lineA: JournalLineValues;
  lineB: JournalLineValues;
};

export const emptyAccountForm = (): AccountFormValues => ({
  code: "",
  name: "",
  type: "Expense",
  parent_account_id: "",
  classification: "operating_expense",
  normal_balance: "debit",
  is_header: false,
});

export const emptyJournalLine = (): JournalLineValues => ({
  account_id: "",
  debit: "",
  credit: "",
});

export const emptyJournalEntryForm = (): JournalEntryFormValues => ({
  description: "",
  lineA: emptyJournalLine(),
  lineB: emptyJournalLine(),
});

export const accountFormSchema: yup.ObjectSchema<AccountFormValues> = yup.object({
  code: yup.string().trim().required("Code is required"),
  name: yup.string().trim().required("Name is required"),
  type: yup.string().required("Type is required"),
  parent_account_id: yup.string().default(""),
  classification: yup.string().required("Classification is required"),
  normal_balance: yup.string().required("Normal balance is required"),
  is_header: yup.boolean().default(false),
});

const journalLineSchema: yup.ObjectSchema<JournalLineValues> = yup.object({
  account_id: yup.string().required("Select an account"),
  debit: yup.string().default(""),
  credit: yup.string().default(""),
});

export const journalEntryFormSchema: yup.ObjectSchema<JournalEntryFormValues> =
  yup.object({
    description: yup.string().trim().required("Description is required"),
    lineA: journalLineSchema.required(),
    lineB: journalLineSchema.required(),
  });
