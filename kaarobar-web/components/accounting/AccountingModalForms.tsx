"use client";

import { useField, useFormikContext } from "formik";
import Select from "@/components/ui/Select";
import {
  FormikCheckboxField,
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import { useT } from "@/lib/i18n";
import type {
  AccountFormValues,
  JournalEntryFormValues,
  JournalLineValues,
} from "@/lib/validations/accounting";

export type { AccountFormValues, JournalEntryFormValues } from "@/lib/validations/accounting";
export {
  emptyAccountForm,
  emptyJournalEntryForm,
} from "@/lib/validations/accounting";

type AccountOption = {
  id: string;
  code: string;
  name: string;
  is_header?: boolean;
};

const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const;
const CLASSIFICATIONS = [
  "current_asset",
  "non_current_asset",
  "current_liability",
  "non_current_liability",
  "equity",
  "revenue",
  "cost_of_sales",
  "operating_expense",
  "other_income",
  "other_expense",
] as const;

const TYPE_DEFAULTS: Record<
  string,
  { classification: string; normal_balance: string }
> = {
  Asset: { classification: "current_asset", normal_balance: "debit" },
  Liability: { classification: "current_liability", normal_balance: "credit" },
  Equity: { classification: "equity", normal_balance: "credit" },
  Revenue: { classification: "revenue", normal_balance: "credit" },
  Expense: { classification: "operating_expense", normal_balance: "debit" },
};

export function AccountFormFields({
  accounts,
  editingAccountId,
}: {
  accounts: AccountOption[];
  editingAccountId?: string | null;
}) {
  const t = useT();

  return (
    <div className="space-y-4">
      <FormikTextField name="code" label="Code" required />
      <FormikTextField name="name" label="Name" required />
      <AccountTypeSelect />
      <FormikSelectField
        name="classification"
        label={t("accounting.classification")}
        options={CLASSIFICATIONS.map((c) => ({
          value: c,
          label: c.replace(/_/g, " "),
        }))}
      />
      <FormikSelectField
        name="normal_balance"
        label={t("accounting.normalBalance")}
        options={[
          { value: "debit", label: "Debit" },
          { value: "credit", label: "Credit" },
        ]}
      />
      <FormikSelectField
        name="parent_account_id"
        label={t("accounting.parentAccount")}
        placeholder="—"
        options={[
          { value: "", label: "—" },
          ...accounts
            .filter((a) => a.id !== editingAccountId)
            .map((a) => ({
              value: a.id,
              label: `${a.code} ${a.name}`,
            })),
        ]}
      />
      <FormikCheckboxField name="is_header" label={t("accounting.headerAccount")} />
    </div>
  );
}

/** Bound Select for account type (keeps label in sync with Formik). */
function AccountTypeSelect() {
  const [field, , helpers] = useField("type");
  const { setFieldValue } = useFormikContext<AccountFormValues>();
  return (
    <Field label="Type">
      <Select
        value={field.value ?? ""}
        onChange={(v) => {
          const d = TYPE_DEFAULTS[v] || TYPE_DEFAULTS.Expense;
          void helpers.setValue(v);
          void setFieldValue("classification", d.classification);
          void setFieldValue("normal_balance", d.normal_balance);
        }}
        options={ACCOUNT_TYPES.map((ty) => ({ value: ty, label: ty }))}
      />
    </Field>
  );
}

function JournalLineFields({
  name,
  accounts,
}: {
  name: "lineA" | "lineB";
  accounts: AccountOption[];
}) {
  const postable = accounts.filter((a) => !a.is_header);
  const { setFieldValue, values } = useFormikContext<JournalEntryFormValues>();
  const line = values[name] as JournalLineValues;

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <Select
        value={line.account_id}
        onChange={(v) => void setFieldValue(`${name}.account_id`, v)}
        required
        placeholder="Account"
        options={[
          { value: "", label: "Account" },
          ...postable.map((a) => ({
            value: a.id,
            label: `${a.code} ${a.name}`,
          })),
        ]}
      />
      <input
        className={fieldClass}
        placeholder="Debit"
        type="number"
        step="0.01"
        value={line.debit}
        onChange={(e) => void setFieldValue(`${name}.debit`, e.target.value)}
        onBlur={(e) => {
          if (e.target.value.trim() === "") return;
          void setFieldValue(`${name}.debit`, formatDecimal(e.target.value));
        }}
      />
      <input
        className={fieldClass}
        placeholder="Credit"
        type="number"
        step="0.01"
        value={line.credit}
        onChange={(e) => void setFieldValue(`${name}.credit`, e.target.value)}
        onBlur={(e) => {
          if (e.target.value.trim() === "") return;
          void setFieldValue(`${name}.credit`, formatDecimal(e.target.value));
        }}
      />
    </div>
  );
}

export function JournalEntryFormFields({
  accounts,
}: {
  accounts: AccountOption[];
}) {
  return (
    <div className="space-y-4">
      <FormikTextField name="description" label="Description" required placeholder="Description" />
      <JournalLineFields name="lineA" accounts={accounts} />
      <JournalLineFields name="lineB" accounts={accounts} />
    </div>
  );
}
