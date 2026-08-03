import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import ProfilePicEditor from "@/components/app/ProfilePicEditor";
import { formatDecimal } from "@/lib/decimal";
import {
  formatAllowanceLabel,
  sumAllowances,
} from "@/lib/hrAllowances";
import { useT } from "@/lib/i18n";

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position?: string;
  join_date?: string;
  basic_salary: string;
  allowances?: Record<string, string | number> | null;
  status: string;
  phone?: string;
  cnic?: string;
  bank_iban?: string;
  overtime_rate?: string;
  branch_id?: string;
  user_id?: string | null;
  profile_pic_url?: string | null;
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
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

  const allowanceFields = useMemo(() => {
    const map = employee?.allowances;
    if (!map || Object.keys(map).length === 0) {
      return [{ label: t("hr.noAllowances"), value: "—" }];
    }
    const rows = Object.entries(map).map(([key, amount]) => ({
      label: formatAllowanceLabel(key),
      value: `Rs ${formatDecimal(String(amount))}`,
    }));
    rows.push({
      label: t("hr.totalAllowances"),
      value: `Rs ${formatDecimal(String(sumAllowances(map)))}`,
    });
    return rows;
  }, [employee?.allowances, t]);

  return (
    <DetailShell
      backHref={`${routes.hr}?tab=employees`}
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
        <>
          <DetailSection title="Photo">
            <ProfilePicEditor
              url={employee.profile_pic_url}
              name={employee.name}
              uploadPath={`/employees/${employee.id}/profile-pic`}
              urlFromResponse={(body) =>
                (body as { data?: Employee })?.data?.profile_pic_url
              }
              onChange={(next) =>
                setEmployee((e) => (e ? { ...e, profile_pic_url: next } : e))
              }
              label="Employee photo"
            />
          </DetailSection>
          <DetailSection title="Employment">
            <DetailFieldGrid
              fields={[
                { label: "Code", value: employee.employee_code },
                { label: "Position", value: employee.position || "—" },
                { label: "Join date", value: employee.join_date || "—" },
                {
                  label: t("hr.basicSalary"),
                  value: `Rs ${formatDecimal(employee.basic_salary)}`,
                },
                {
                  label: "Overtime rate",
                  value: employee.overtime_rate
                    ? formatDecimal(employee.overtime_rate)
                    : "—",
                },
                { label: "Phone", value: employee.phone || "—" },
                { label: "CNIC", value: employee.cnic || "—" },
                { label: "Bank IBAN", value: employee.bank_iban || "—" },
                {
                  label: "Portal login",
                  value: employee.user_id ? "Linked" : "Not linked",
                },
              ]}
            />
          </DetailSection>
          <DetailSection title={t("hr.allowances")}>
            <DetailFieldGrid fields={allowanceFields} />
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
