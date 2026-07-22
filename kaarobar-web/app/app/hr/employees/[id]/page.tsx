"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position?: string;
  join_date?: string;
  basic_salary: string;
  status: string;
  phone?: string;
  cnic?: string;
  bank_iban?: string;
  overtime_rate?: string;
  branch_id?: string;
  user_id?: string | null;
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Employee }>(`/employees/${id}`);
      setEmployee(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DetailShell
      backHref={routes.hr}
      backLabel="Back to HR"
      eyebrow="Employee"
      title={employee?.name || "Employee"}
      subtitle={employee?.employee_code}
      status={
        employee
          ? {
              label: employee.status,
              tone: employee.status === "active" ? "success" : "warning",
            }
          : undefined
      }
      loading={loading}
      error={error}
    >
      {employee ? (
        <DetailSection title="Employment">
          <DetailFieldGrid
            fields={[
              { label: "Code", value: employee.employee_code },
              { label: "Position", value: employee.position || "—" },
              { label: "Join date", value: employee.join_date || "—" },
              { label: "Basic salary", value: `Rs ${employee.basic_salary}` },
              { label: "Overtime rate", value: employee.overtime_rate || "—" },
              { label: "Phone", value: employee.phone || "—" },
              { label: "CNIC", value: employee.cnic || "—" },
              { label: "Bank IBAN", value: employee.bank_iban || "—" },
              { label: "Portal login", value: employee.user_id ? "Linked" : "Not linked" },
            ]}
          />
        </DetailSection>
      ) : null}
    </DetailShell>
  );
}
