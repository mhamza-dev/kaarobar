import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { useTabQueryParam } from "@/lib/hooks/useTabQueryParam";
import {
  DetailFieldGrid,
  DetailSection,
  DetailShell,
} from "@/components/app/DetailShell";
import BrandColorPicker from "@/components/app/BrandColorPicker";
import {
  clearStaffBrandPreview,
  previewStaffBrand,
} from "@/components/app/BrandTheme";
import FormModalFooter from "@/components/app/FormModalFooter";
import { TabBar, formGridClass, formStackClass } from "@/components/app/ui";
import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import Modal from "@/components/modals/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import {
  branchFormSchema,
  businessBrandingFormSchema,
  businessDetailsFormSchema,
  emptyBranchForm,
  emptyBusinessBrandingForm,
  emptyBusinessDetailsForm,
  type BranchFormValues,
  type BusinessBrandingFormValues,
  type BusinessDetailsFormValues,
} from "@/lib/validations/businesses";

type Business = {
  id: string;
  name: string;
  industry?: string | null;
  tax_jurisdiction?: string | null;
  is_active?: boolean;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
  fbr_tier1?: boolean;
};

type Branch = {
  id: string;
  name: string;
  timezone?: string | null;
  is_active?: boolean;
  refund_auto_approve_limit?: string;
  discount_auto_approve_limit?: string;
};

type DetailTab = "details" | "branches" | "branding";
const DETAIL_TABS: readonly DetailTab[] = ["details", "branches", "branding"];

const INDUSTRIES = [
  "retail",
  "restaurant",
  "salon",
  "pharmacy",
  "supermarket",
  "wholesale",
  "general",
] as const;

export default function BusinessDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <BusinessDetailPageInner />
    </Suspense>
  );
}

function BusinessDetailPageInner() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tab, setTab] = useTabQueryParam<DetailTab>("details", DETAIL_TABS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branchModal, setBranchModal] = useState(false);
  const [detailsInitial, setDetailsInitial] = useState(
    emptyBusinessDetailsForm()
  );
  const [brandingInitial, setBrandingInitial] = useState(
    emptyBusinessBrandingForm()
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [b, br] = await Promise.all([
        api<{ data: Business }>(`/businesses/${id}`),
        api<{ data: Branch[] }>(`/businesses/${id}/branches?include_inactive=true`),
      ]);
      setBusiness(b.data);
      setBranches(br.data || []);
      setDetailsInitial({
        name: b.data.name || "",
        industry: b.data.industry || "retail",
        tax_jurisdiction: b.data.tax_jurisdiction || "PK",
        tagline: b.data.tagline || "",
      });
      setBrandingInitial({
        tagline: b.data.tagline || "",
        primary_color: b.data.primary_color || "",
        marketplace_description: b.data.marketplace_description || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => clearStaffBrandPreview();
  }, []);

  const industryOptions = useMemo(
    () => INDUSTRIES.map((ind) => ({ value: ind, label: ind })),
    []
  );

  async function saveDetails(values: BusinessDetailsFormValues) {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/businesses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name.trim(),
          industry: values.industry,
          tax_jurisdiction: values.tax_jurisdiction || "PK",
          tagline: values.tagline.trim() || null,
        }),
      });
      toast.success(t("common.success"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBranding(values: BusinessBrandingFormValues) {
    if (!id || !business) return;
    setBusy(true);
    try {
      await api(`/businesses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: business.name.trim(),
          tagline: values.tagline.trim() || null,
          primary_color: values.primary_color || null,
          marketplace_description: values.marketplace_description.trim() || null,
        }),
      });
      toast.success(t("businesses.brandingSaved"));
      clearStaffBrandPreview();
      window.dispatchEvent(new Event("kaarobar:branding"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!id) return;
    try {
      const fd = new FormData();
      fd.append("logo", file);
      await api(`/businesses/${id}/logo`, { method: "POST", body: fd });
      toast.success(t("businesses.logoUpdated"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function clearLogo() {
    if (!id) return;
    try {
      await api(`/businesses/${id}/logo`, { method: "DELETE" });
      toast.success(t("businesses.logoRemoved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function createBranch(values: BranchFormValues) {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/businesses/${id}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: values.name.trim(), timezone: "Asia/Karachi" }),
      });
      toast.success(t("businesses.branchCreated"));
      setBranchModal(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function deactivateBranch(branch: Branch) {
    if (!confirm(t("businesses.deactivateBranchConfirm", { name: branch.name }))) {
      return;
    }
    try {
      await api(`/businesses/${id}/branches/${branch.id}/deactivate`, {
        method: "POST",
        body: "{}",
      });
      toast.success(t("businesses.branchDeactivated"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function deactivateBusiness() {
    if (!business) return;
    if (!confirm(t("businesses.deactivateConfirm", { name: business.name }))) return;
    try {
      await api(`/businesses/${business.id}/deactivate`, { method: "POST", body: "{}" });
      toast.success(t("businesses.deactivated"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  const tabs = [
    { id: "details" as const, label: t("businesses.tabDetails"), infoKey: "tab.businesses.details" },
    { id: "branches" as const, label: t("businesses.tabBranches"), infoKey: "tab.businesses.branches" },
    { id: "branding" as const, label: t("businesses.tabBranding"), infoKey: "tab.businesses.branding" },
  ];

  return (
    <DetailShell
      backHref={routes.businesses}
      backLabel={t("businesses.back")}
      eyebrow={t("businesses.eyebrow")}
      title={business?.name || t("pages.businessesTitle")}
      subtitle={business?.industry || undefined}
      status={
        business
          ? business.is_active === false
            ? { label: t("businesses.inactive"), tone: "info" }
            : { label: t("businesses.active"), tone: "success" }
          : undefined
      }
      loading={loading}
      error={error}
      actions={
        business?.is_active !== false ? (
          <Button variant="danger" size="sm" onClick={() => void deactivateBusiness()}>
            {t("businesses.deactivate")}
          </Button>
        ) : null
      }
    >
      {business ? (
        <div className="space-y-6">
          <TabBar
            tabs={tabs}
            value={tab}
            onChange={setTab}
            aria-label="Business sections"
          />

          {tab === "details" ? (
            <DetailSection title={t("businesses.tabDetails")}>
              <CustomForm
                initialValues={detailsInitial}
                validationSchema={businessDetailsFormSchema}
                onSubmit={saveDetails}
                className={formStackClass}
              >
                {() => (
                  <>
                    <div className={formGridClass}>
                      <FormikTextField name="name" label={t("common.name")} required />
                      <FormikSelectField
                        name="industry"
                        label={t("businesses.industry")}
                        options={industryOptions}
                      />
                      <FormikTextField
                        name="tax_jurisdiction"
                        label={t("businesses.taxJurisdiction")}
                      />
                      <FormikTextField name="tagline" label={t("businesses.tagline")} />
                    </div>
                    <DetailFieldGrid
                      fields={[
                        {
                          label: t("settings.fbrTitle"),
                          value: business.fbr_tier1
                            ? t("common.enabled")
                            : t("common.disabled"),
                        },
                      ]}
                    />
                    <Button type="submit" loading={busy}>
                      {t("common.save")}
                    </Button>
                  </>
                )}
              </CustomForm>
            </DetailSection>
          ) : null}

          {tab === "branches" ? (
            <DetailSection
              title={t("businesses.tabBranches")}
              description={t("businesses.branchesDesc")}
            >
              <div className="mb-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setBranchModal(true);
                  }}
                >
                  {t("businesses.addBranch")}
                </Button>
              </div>
              <ul className="divide-y divide-border">
                {branches.length === 0 ? (
                  <li className="py-4 text-sm text-body">{t("businesses.noBranches")}</li>
                ) : (
                  branches.map((branch) => (
                    <li
                      key={branch.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-medium text-heading">{branch.name}</p>
                        <p className="text-xs text-body">
                          {branch.timezone || "Asia/Karachi"} ·{" "}
                          {branch.is_active === false
                            ? t("businesses.inactive")
                            : t("businesses.active")}
                        </p>
                      </div>
                      {branch.is_active !== false ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void deactivateBranch(branch)}
                        >
                          {t("businesses.deactivate")}
                        </Button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </DetailSection>
          ) : null}

          {tab === "branding" ? (
            <DetailSection title={t("businesses.tabBranding")}>
              <CustomForm
                initialValues={brandingInitial}
                validationSchema={businessBrandingFormSchema}
                onSubmit={saveBranding}
                className={formStackClass}
              >
                {({ values, setFieldValue }) => (
                  <>
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card-muted">
                        {business.logo_url ? (
                          <img
                            src={business.logo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-heading">
                            {(business.name || "?").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium text-heading hover:bg-bg-hover">
                            {t("businesses.uploadLogo")}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadLogo(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {business.logo_url ? (
                            <button
                              type="button"
                              onClick={() => void clearLogo()}
                              className="rounded-md border border-border px-3 py-1.5 text-sm text-body"
                            >
                              {t("businesses.removeLogo")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <FormikTextField name="tagline" label={t("businesses.tagline")} />
                    <div className="text-xs text-body">
                      <span className="mb-1.5 block font-medium text-heading">
                        {t("businesses.brandColor")}
                      </span>
                      <BrandColorPicker
                        value={values.primary_color || null}
                        onChange={(hex) => {
                          void setFieldValue("primary_color", hex);
                          previewStaffBrand(business.id, hex);
                        }}
                      />
                      <div
                        className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border bg-bg-secondary/60 p-4"
                        style={
                          values.primary_color
                            ? ({
                                ["--brand" as string]: values.primary_color,
                                ["--color-brand" as string]: values.primary_color,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                          style={{ backgroundColor: values.primary_color || "#1D4ED8" }}
                        >
                          {t("businesses.previewButton")}
                        </button>
                      </div>
                    </div>
                    <FormikTextField
                      name="marketplace_description"
                      label={t("businesses.marketplaceDesc")}
                      type="textarea"
                      rows={3}
                    />
                    <Button type="submit" loading={busy}>
                      {t("businesses.saveBranding")}
                    </Button>
                  </>
                )}
              </CustomForm>
            </DetailSection>
          ) : null}
        </div>
      ) : null}

      <Modal
        isOpen={branchModal}
        onClose={() => setBranchModal(false)}
        title={t("businesses.addBranch")}
        footer={
          <FormModalFooter
            cancelLabel={t("common.cancel")}
            submitLabel={t("common.create")}
            onCancel={() => setBranchModal(false)}
            submitFormId="create-branch-form"
            loading={busy}
            cancelVariant="secondary"
          />
        }
      >
        <CustomForm
          id="create-branch-form"
          initialValues={emptyBranchForm()}
          validationSchema={branchFormSchema}
          onSubmit={createBranch}
          className={formStackClass}
        >
          {() => <FormikTextField name="name" label={t("common.name")} required />}
        </CustomForm>
      </Modal>
    </DetailShell>
  );
}
