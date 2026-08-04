"use client";

import { FieldArray, useFormikContext } from "formik";
import Button from "@/components/ui/Button";
import {
  FormikDateTimeField,
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import type { EmployeeFormValues } from "@/lib/validations/hr";

export type { EmployeeFormValues, InviteFormValues, PayrollDraftFormValues } from "@/lib/validations/hr";
export {
  emptyEmployeeForm,
  emptyInviteForm,
} from "@/lib/validations/hr";

const ROLE_OPTIONS = [
  "cashier",
  "branch_manager",
  "inventory_manager",
  "accountant",
  "hr_manager",
  "employee",
].map((r) => ({ value: r, label: r }));

export function EmployeeFormFields({
  editing,
  t,
}: {
  editing: boolean;
  t: (key: string) => string;
}) {
  const { values } = useFormikContext<EmployeeFormValues>();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormikTextField name="employee_code" label="Employee code" required />
        <FormikTextField name="name" label="Full name" required />
        <FormikTextField name="position" label="Position" />
        <FormikTextField
          name="basic_salary"
          label={t("hr.basicSalary")}
          type="number"
        />
        {editing ? (
          <FormikSelectField
            name="status"
            label="Status"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "terminated", label: "Terminated" },
            ]}
          />
        ) : null}
      </div>

      <div className="space-y-3">
        <FieldArray name="allowances">
          {({ push, remove }) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-heading">
                  {t("hr.allowances")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => push({ name: "", amount: "0" })}
                >
                  {t("hr.addAllowance")}
                </Button>
              </div>
              <p className="text-xs text-muted">{t("hr.allowancesHint")}</p>
              <div className="space-y-2">
                {values.allowances.map((_row, index) => (
                  <div
                    key={`allowance-${index}`}
                    className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                  >
                    <FormikTextField
                      name={`allowances.${index}.name`}
                      label={t("hr.allowanceName")}
                      placeholder="transport"
                      required={values.allowances.length === 1}
                    />
                    <FormikTextField
                      name={`allowances.${index}.amount`}
                      label={t("hr.allowanceAmount")}
                      type="number"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-0.5"
                      disabled={values.allowances.length <= 1}
                      onClick={() => remove(index)}
                    >
                      {t("hr.removeAllowance")}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </FieldArray>
      </div>
    </>
  );
}

export function InviteFormFields() {
  return (
    <div className="space-y-4">
      <FormikTextField
        name="email"
        label="Email"
        type="email"
        placeholder="cashier@kaarobar.local"
        required
      />
      <FormikSelectField name="roles" label="Role" options={ROLE_OPTIONS} />
    </div>
  );
}

export function PayrollDraftFormFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormikDateTimeField
        name="period_start"
        label="Period start"
        mode="date"
        required
      />
      <FormikDateTimeField
        name="period_end"
        label="Period end"
        mode="date"
        required
      />
    </div>
  );
}
