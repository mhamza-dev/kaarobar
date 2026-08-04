import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { api } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import ActionMenu from "@/components/ui/ActionMenu";
import {
  PageHeader,
  SurfaceCard,
} from "@/components/app/ui";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import {
  businessCreateFormSchema,
  emptyBusinessCreateForm,
  type BusinessCreateFormValues,
} from "@/lib/validations/businesses";
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

export default function BusinessesPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [formInitial, setFormInitial] = useState(() => emptyBusinessCreateForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: Business[] }>("/businesses?include_inactive=true");
      setBusinesses(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createBusiness(values: BusinessCreateFormValues) {
    setBusy(true);
    try {
      const res = await api<{ data: Business }>("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          industry: values.industry,
          tax_jurisdiction: values.tax_jurisdiction || "PK",
          tagline: values.tagline.trim() || null,
        }),
      });
      toast.success(t("businesses.created"));
      setModal(false);
      setFormInitial(emptyBusinessCreateForm());
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
            setFormInitial(emptyBusinessCreateForm());
            setModal(true);
          },
          icon: <Building2 className="h-4 w-4" />,
        }}
      />

      <SurfaceCard className="p-0">
        <DataTable
          maxHeight="28rem"
          loading={loading}
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
              width: 48,
              cell: (b) => (
                <div className="flex justify-end">
                  <ActionMenu
                    items={[
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
        <CustomForm
          className="space-y-4"
          initialValues={formInitial}
          validationSchema={businessCreateFormSchema}
          onSubmit={createBusiness}
        >
          {() => (
            <>
              <FormikTextField name="name" label={t("common.name")} required />
              <FormikSelectField
                name="industry"
                label={t("businesses.industry")}
                options={INDUSTRIES.map((ind) => ({ value: ind, label: ind }))}
              />
              <FormikTextField
                name="tax_jurisdiction"
                label={t("businesses.taxJurisdiction")}
              />
              <FormikTextField name="tagline" label={t("businesses.tagline")} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setModal(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={busy}>
                  {t("common.create")}
                </Button>
              </div>
            </>
          )}
        </CustomForm>
      </Modal>
    </div>
  );
}
