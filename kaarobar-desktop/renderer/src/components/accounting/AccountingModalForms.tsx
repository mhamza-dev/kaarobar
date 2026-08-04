import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import { useT } from "@/lib/i18n";

export type AccountForm = {
  code: string;
  name: string;
  type: string;
  parent_account_id: string;
  classification: string;
  normal_balance: string;
  is_header: boolean;
};

type JournalLine = { account_id: string; debit: string; credit: string };
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

export const emptyAccountForm: AccountForm = {
  code: "",
  name: "",
  type: "Expense",
  parent_account_id: "",
  classification: "operating_expense",
  normal_balance: "debit",
  is_header: false,
};

export function AccountFormFields({
  form,
  onChange,
  accounts,
  editingAccountId,
}: {
  form: AccountForm;
  onChange: (next: AccountForm) => void;
  accounts: AccountOption[];
  editingAccountId?: string | null;
}) {
  const t = useT();

  return (
    <>
      <Field label="Code">
        <input
          className={fieldClass}
          value={form.code}
          onChange={(e) => onChange({ ...form, code: e.target.value })}
          required
        />
      </Field>
      <Field label="Name">
        <input
          className={fieldClass}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="Type">
        <Select
          value={form.type}
          onChange={(v) => {
            const defaults: Record<string, { classification: string; normal_balance: string }> = {
              Asset: { classification: "current_asset", normal_balance: "debit" },
              Liability: { classification: "current_liability", normal_balance: "credit" },
              Equity: { classification: "equity", normal_balance: "credit" },
              Revenue: { classification: "revenue", normal_balance: "credit" },
              Expense: { classification: "operating_expense", normal_balance: "debit" },
            };
            const d = defaults[v] || defaults.Expense;
            onChange({
              ...form,
              type: v,
              classification: d.classification,
              normal_balance: d.normal_balance,
            });
          }}
          options={ACCOUNT_TYPES.map((ty) => ({ value: ty, label: ty }))}
          triggerClassName="border-border bg-bg-secondary/80"
        />
      </Field>
      <Field label={t("accounting.classification")}>
        <Select
          value={form.classification}
          onChange={(v) => onChange({ ...form, classification: v })}
          options={CLASSIFICATIONS.map((c) => ({
            value: c,
            label: c.replace(/_/g, " "),
          }))}
          triggerClassName="border-border bg-bg-secondary/80"
        />
      </Field>
      <Field label={t("accounting.normalBalance")}>
        <Select
          value={form.normal_balance}
          onChange={(v) => onChange({ ...form, normal_balance: v })}
          options={[
            { value: "debit", label: "Debit" },
            { value: "credit", label: "Credit" },
          ]}
          triggerClassName="border-border bg-bg-secondary/80"
        />
      </Field>
      <Field label={t("accounting.parentAccount")}>
        <Select
          value={form.parent_account_id}
          onChange={(v) => onChange({ ...form, parent_account_id: v })}
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
          triggerClassName="border-border bg-bg-secondary/80"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-heading">
        <input
          type="checkbox"
          checked={form.is_header}
          onChange={(e) => onChange({ ...form, is_header: e.target.checked })}
        />
        {t("accounting.headerAccount")}
      </label>
    </>
  );
}

export function JournalEntryFormFields({
  description,
  onDescriptionChange,
  lines,
  onLineChange,
  accounts,
}: {
  description: string;
  onDescriptionChange: (value: string) => void;
  lines: readonly [JournalLine, JournalLine];
  onLineChange: (index: 0 | 1, next: JournalLine) => void;
  accounts: AccountOption[];
}) {
  const postable = accounts.filter((a) => !a.is_header);

  return (
    <>
      <Field label="Description">
        <input
          className={fieldClass}
          placeholder="Description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          required
        />
      </Field>
      {lines.map((line, idx) => (
        <div key={idx} className="grid gap-2 md:grid-cols-3">
          <Select
            name={`je-account-${idx}`}
            required
            value={line.account_id}
            onChange={(v) => onLineChange(idx as 0 | 1, { ...line, account_id: v })}
            placeholder="Account"
            options={postable.map((a) => ({
              value: a.id,
              label: `${a.code} ${a.name}`,
            }))}
            triggerClassName="border-border bg-bg-secondary/80"
          />
          <input
            className={fieldClass}
            type="number"
            step="0.01"
            min={0}
            placeholder="Debit"
            value={line.debit}
            onChange={(e) => onLineChange(idx as 0 | 1, { ...line, debit: e.target.value })}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) return;
              onLineChange(idx as 0 | 1, { ...line, debit: formatDecimal(v) });
            }}
          />
          <input
            className={fieldClass}
            type="number"
            step="0.01"
            min={0}
            placeholder="Credit"
            value={line.credit}
            onChange={(e) => onLineChange(idx as 0 | 1, { ...line, credit: e.target.value })}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) return;
              onLineChange(idx as 0 | 1, { ...line, credit: formatDecimal(v) });
            }}
          />
        </div>
      ))}
    </>
  );
}
