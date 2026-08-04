import * as yup from "yup";
import { defaultAllowanceRows, type AllowanceRow } from "@/lib/hrAllowances";

export type EmployeeFormValues = {
  employee_code: string;
  name: string;
  position: string;
  basic_salary: string;
  allowances: AllowanceRow[];
  status: string;
};

export type InviteFormValues = {
  email: string;
  roles: string;
};

export type PayrollDraftFormValues = {
  period_start: string;
  period_end: string;
};

export const emptyEmployeeForm = (): EmployeeFormValues => ({
  employee_code: "",
  name: "",
  position: "Cashier",
  basic_salary: "30000",
  allowances: defaultAllowanceRows(),
  status: "active",
});

export const emptyInviteForm = (): InviteFormValues => ({
  email: "",
  roles: "cashier",
});

export const employeeFormSchema: yup.ObjectSchema<EmployeeFormValues> = yup.object(
  {
    employee_code: yup.string().trim().required("Employee code is required"),
    name: yup.string().trim().required("Name is required"),
    position: yup.string().trim().default(""),
    basic_salary: yup.string().trim().default(""),
    allowances: yup
      .array()
      .of(
        yup.object({
          name: yup.string().default(""),
          amount: yup.string().default("0"),
        })
      )
      .default([]),
    status: yup.string().default("active"),
  }
);

export const inviteFormSchema: yup.ObjectSchema<InviteFormValues> = yup.object({
  email: yup
    .string()
    .trim()
    .email("Enter a valid email")
    .required("Email is required"),
  roles: yup.string().required("Role is required"),
});

export const payrollDraftFormSchema: yup.ObjectSchema<PayrollDraftFormValues> =
  yup.object({
    period_start: yup.string().required("Period start is required"),
    period_end: yup.string().required("Period end is required"),
  });
