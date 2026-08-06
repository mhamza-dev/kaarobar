"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import FormModal from "@/components/app/FormModal";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
} from "@/components/ui/FormFields";
import {
  Alert,
  EmptyState,
  PageHeader,
  StatusBadge,
  formStackClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import {
  bookableResourceFormSchema,
  emptyBookableResourceForm,
  type BookableResourceFormValues,
} from "@/lib/validations/appointments";
import {
  emptyStaffListFilters,
  type StaffListFilterState,
} from "@/lib/listFilters";

type ResourceRow = {
  id: string;
  name: string;
  kind: string;
  capacity: number;
  is_active: boolean;
  notes?: string | null;
  branch_id?: string;
};

/** Branch-scoped bookable resources admin (FUT-FR-081). */
export default function BookableResourcesPage() {
  const t = useT();
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [filters, setFilters] = useState<StaffListFilterState>(
    emptyStaffListFilters()
  );

  useEffect(() => {
    const session = getSession();
    if (!session?.business_id) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    void api<{ data: { appointments_enabled?: boolean; industry?: string } }>(
      `/businesses/${session.business_id}`
    )
      .then((res) => {
        setEnabled(
          !!res.data.appointments_enabled || res.data.industry === "salon"
        );
      })
      .catch(() => setEnabled(false));
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: ResourceRow[] }>(
        "/bookable-resources?active_only=false"
      );
      setRows(res.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("resources.loadFailed")
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, t]);

  useEffect(() => {
    if (enabled) void load();
    else if (enabled === false) setLoading(false);
  }, [enabled, load]);

  const initialValues = useMemo((): BookableResourceFormValues => {
    if (!editing) return emptyBookableResourceForm();
    return {
      name: editing.name,
      kind: editing.kind as "room" | "chair" | "equipment",
      capacity: String(editing.capacity || 1),
      notes: editing.notes || "",
      is_active: editing.is_active,
    };
  }, [editing]);

  async function save(values: BookableResourceFormValues) {
    setBusy(true);
    try {
      const body = JSON.stringify({
        name: values.name.trim(),
        kind: values.kind,
        capacity: values.capacity || "1",
        notes: values.notes.trim() || undefined,
        is_active: values.is_active,
      });
      if (editing) {
        await api(`/bookable-resources/${editing.id}`, {
          method: "PATCH",
          body,
        });
        toast.success(t("resources.updated"));
      } else {
        await api("/bookable-resources", { method: "POST", body });
        toast.success(t("resources.created"));
      }
      setModal(null);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("resources.saveFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    setBusy(true);
    try {
      await api(`/bookable-resources/${id}`, { method: "DELETE" });
      toast.success(t("resources.deactivated"));
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("resources.saveFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  if (enabled === false) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("nav.cashier")}
          title={t("pages.resourcesTitle")}
          description={t("pages.resourcesDesc")}
          infoKey="page.resources"
        />
        <EmptyState
          title={t("appointments.disabledTitle")}
          body={t("appointments.disabledBody")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.cashier")}
        title={t("pages.resourcesTitle")}
        description={t("pages.resourcesDesc")}
        infoKey="page.resources"
        action={{
          label: t("resources.new"),
          onClick: () => {
            setEditing(null);
            setModal("create");
          },
        }}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <DataTable
        data={rows}
        loading={loading || enabled === null}
        filterState={filters}
        onFilterChange={setFilters}
        filterConfig={{
          showDateRange: false,
          statusOptions: [
            { value: "active", label: t("resources.active") },
            { value: "inactive", label: t("resources.inactive") },
          ],
        }}
        filterAccessors={{
          searchText: (r) => [r.name, r.kind, r.notes].filter(Boolean).join(" "),
          status: (r) => (r.is_active ? "active" : "inactive"),
        }}
        clientFilter
        searchPlaceholder={t("resources.searchPlaceholder")}
        pagination={{ mode: "client", pageSize: 20 }}
        emptyTitle={t("resources.emptyTitle")}
        emptyBody={t("resources.emptyBody")}
        rowKey={(r) => r.id}
        columns={[
          {
            id: "name",
            header: t("resources.name"),
            cell: (r) => r.name,
          },
          {
            id: "kind",
            header: t("resources.kind"),
            cell: (r) =>
              r.kind === "room"
                ? t("resources.kindRoom")
                : r.kind === "equipment"
                  ? t("resources.kindEquipment")
                  : t("resources.kindChair"),
          },
          {
            id: "capacity",
            header: t("resources.capacity"),
            cell: (r) => r.capacity,
          },
          {
            id: "status",
            header: t("common.status"),
            cell: (r) => (
              <StatusBadge tone={r.is_active ? "success" : "danger"}>
                {r.is_active ? t("resources.active") : t("resources.inactive")}
              </StatusBadge>
            ),
          },
          {
            id: "actions",
            header: "",
            cell: (r) => (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-md"
                  onClick={() => {
                    setEditing(r);
                    setModal("edit");
                  }}
                >
                  {t("common.edit")}
                </Button>
                {r.is_active ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-md"
                    loading={busy}
                    onClick={() => void deactivate(r.id)}
                  >
                    {t("resources.deactivate")}
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <FormModal
        isOpen={modal === "create" || modal === "edit"}
        onClose={() => {
          setModal(null);
          setEditing(null);
        }}
        title={editing ? t("resources.edit") : t("resources.new")}
        description={t("resources.formDesc")}
        formId="bookable-resource-form"
        submitLabel={editing ? t("common.save") : t("resources.create")}
        cancelLabel={t("common.cancel")}
        submitLoading={busy}
      >
        <CustomForm<BookableResourceFormValues>
          id="bookable-resource-form"
          className={formStackClass}
          initialValues={initialValues}
          validationSchema={bookableResourceFormSchema}
          enableReinitialize
          onSubmit={(values) => void save(values)}
        >
          {() => (
            <div className={formStackClass}>
              <FormikTextField name="name" label={t("resources.name")} required />
              <FormikSelectField
                name="kind"
                label={t("resources.kind")}
                options={[
                  { value: "chair", label: t("resources.kindChair") },
                  { value: "room", label: t("resources.kindRoom") },
                  { value: "equipment", label: t("resources.kindEquipment") },
                ]}
              />
              <FormikTextField
                name="capacity"
                label={t("resources.capacity")}
                type="number"
              />
              <FormikTextField
                name="notes"
                label={t("resources.notes")}
                type="textarea"
                rows={2}
              />
              {editing ? (
                <FormikSwitchField
                  name="is_active"
                  label={t("resources.active")}
                />
              ) : null}
            </div>
          )}
        </CustomForm>
      </FormModal>
    </div>
  );
}
