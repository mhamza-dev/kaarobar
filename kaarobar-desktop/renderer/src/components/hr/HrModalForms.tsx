import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Field, fieldClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import type { AllowanceRow } from "@/lib/hrAllowances";

type EmployeeForm = {
  employee_code: string;
  name: string;
  position: string;
  basic_salary: string;
  allowances: AllowanceRow[];
  status: string;
};

export function EmployeeFormFields({
  form,
  editing,
  onChange,
  onAllowanceChange,
  onAddAllowance,
  onRemoveAllowance,
  t,
}: {
  form: EmployeeForm;
  editing: boolean;
  onChange: (next: EmployeeForm) => void;
  onAllowanceChange: (index: number, patch: Partial<AllowanceRow>) => void;
  onAddAllowance: () => void;
  onRemoveAllowance: (index: number) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employee code"><input className={fieldClass} value={form.employee_code} onChange={(e) => onChange({ ...form, employee_code: e.target.value })} required /></Field>
        <Field label="Full name"><input className={fieldClass} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} required /></Field>
        <Field label="Position"><input className={fieldClass} value={form.position} onChange={(e) => onChange({ ...form, position: e.target.value })} /></Field>
        <Field label={t("hr.basicSalary")}><input className={fieldClass} type="number" step="0.01" min={0} value={form.basic_salary} onChange={(e) => onChange({ ...form, basic_salary: e.target.value })} onBlur={() => { if (!form.basic_salary.trim()) return; onChange({ ...form, basic_salary: formatDecimal(form.basic_salary) }); }} /></Field>
        {editing ? <Field label="Status"><Select value={form.status} onChange={(v) => onChange({ ...form, status: v })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "terminated", label: "Terminated" }]} triggerClassName="border-border bg-bg-secondary/80" /></Field> : null}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-heading">{t("hr.allowances")}</p>
          <Button type="button" variant="outline" size="sm" onClick={onAddAllowance}>{t("hr.addAllowance")}</Button>
        </div>
        <p className="text-xs text-muted">{t("hr.allowancesHint")}</p>
        <div className="space-y-2">
          {form.allowances.map((row, index) => (
            <div key={`allowance-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Field label={t("hr.allowanceName")}><input className={fieldClass} value={row.name} placeholder="transport" onChange={(e) => onAllowanceChange(index, { name: e.target.value })} required={form.allowances.length === 1} /></Field>
              <Field label={t("hr.allowanceAmount")}><input className={fieldClass} type="number" step="0.01" min={0} value={row.amount} onChange={(e) => onAllowanceChange(index, { amount: e.target.value })} onBlur={() => { if (!row.amount.trim()) return; onAllowanceChange(index, { amount: formatDecimal(row.amount) }); }} /></Field>
              <Button type="button" variant="outline" size="sm" className="mb-0.5" disabled={form.allowances.length <= 1} onClick={() => onRemoveAllowance(index)}>{t("hr.removeAllowance")}</Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
