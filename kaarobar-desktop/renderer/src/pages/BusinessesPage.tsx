import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import {
  Field,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";

type Business = {
  id: string;
  name: string;
  industry?: string | null;
  tax_jurisdiction?: string | null;
  is_active?: boolean;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  fbr_tier1?: boolean;
};

const INDUSTRIES = [
  "retail",
  "restaurant",
  "salon",
  "pharmacy",
  "supermarket",
  "wholesale",
  "general",
] as const;

const emptyForm = {
  name: "",
  industry: "retail",
  tax_jurisdiction: "PK",
  tagline: "",
};

export default function BusinessesPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Business[] }>("/businesses?include_inactive=true");
      setBusinesses(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ data: Business }>("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry,
          tax_jurisdiction: form.tax_jurisdiction || "PK",
          tagline: form.tagline.trim() || null,
        }),
      });
      toast.success(t("businesses.created"));
      setModal(false);
      setForm(emptyForm);
      await load();
      if (res.data?.id) navigate(detailRoutes.business(res.data.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(b: Business) {
    if (!confirm(t("businesses.deactivateConfirm", { name: b.name }))) return;
    try {
      await api(`/businesses/${b.id}/deactivate`, { method: "POST", body: "{}" });
      toast.success(t("businesses.deactivated"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("businesses.eyebrow")}
        title={t("pages.businessesTitle")}
        description={t("pages.businessesDesc")}
        infoKey="page.businesses"
        action={{
          label: t("businesses.add"),
          onClick: () => {
            setForm(emptyForm);
            setModal(true);
          },
        }}
      />

      <SurfaceCard className="p-0">
        <DataTable
          maxHeight="28rem"
          searchable
          searchPlaceholder={t("businesses.search")}
          getSearchText={(b) => `${b.name} ${b.industry || ""} ${b.tax_jurisdiction || ""}`}
          onRowClick={(b) => navigate(detailRoutes.business(b.id))}
          columns={[
            {
              id: "name",
              header: t("common.name"),
              cell: (b) => (
                <Link
                  to={detailRoutes.business(b.id)}
                  className="font-semibold text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {b.name}
                </Link>
              ),
            },
            {
              id: "industry",
              header: t("businesses.industry"),
              cell: (b) => b.industry || "—",
            },
            {
              id: "status",
              header: t("common.status"),
              cell: (b) =>
                b.is_active === false
                  ? t("businesses.inactive")
                  : t("businesses.active"),
            },
            {
              id: "actions",
              header: "",
              align: "right",
              width: 56,
              cell: (b) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
                      {
                        id: "open",
                        label: t("businesses.open"),
                        onClick: () => navigate(detailRoutes.business(b.id)),
                      },
                      {
                        id: "deactivate",
                        label: t("businesses.deactivate"),
                        onClick: () => void deactivate(b),
                        hidden: b.is_active === false,
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          data={businesses}
          rowKey={(b) => b.id}
          emptyTitle={t("businesses.emptyTitle")}
          emptyBody={t("businesses.emptyBody")}
        />
      </SurfaceCard>

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={t("businesses.add")}
      >
        <form onSubmit={createBusiness} className="space-y-4">
          <Field label={t("common.name")}>
            <input
              className={fieldClass}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t("businesses.industry")}>
            <select
              className={fieldClass}
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("businesses.taxJurisdiction")}>
            <input
              className={fieldClass}
              value={form.tax_jurisdiction}
              onChange={(e) =>
                setForm({ ...form, tax_jurisdiction: e.target.value })
              }
            />
          </Field>
          <Field label={t("businesses.tagline")}>
            <input
              className={fieldClass}
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("common.create")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
