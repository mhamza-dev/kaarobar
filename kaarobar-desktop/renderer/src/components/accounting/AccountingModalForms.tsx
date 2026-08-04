import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";

type AccountForm = { code: string; name: string; type: string };
type JournalLine = { account_id: string; debit: string; credit: string };
type AccountOption = { id: string; code: string; name: string };

export function AccountFormFields({
  form,
  onChange,
}: {
  form: AccountForm;
  onChange: (next: AccountForm) => void;
}) {
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
          onChange={(v) => onChange({ ...form, type: v })}
          options={["asset", "liability", "equity", "revenue", "expense"].map((t) => ({
            value: t,
            label: t,
          }))}
          triggerClassName="border-border bg-bg-secondary/80"
        />
      </Field>
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
            options={accounts.map((a) => ({
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
