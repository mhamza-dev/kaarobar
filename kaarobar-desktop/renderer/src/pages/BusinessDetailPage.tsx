import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
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
import { Field, TabBar, fieldClass } from "@/components/app/ui";
import Button from "@/components/ui/Button";
import Modal from "@/components/modals/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

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
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const toast = useToast();
  const [business, setBusiness] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tab, setTab] = useState<DetailTab>("details");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branchModal, setBranchModal] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [form, setForm] = useState({
    name: "",
    industry: "retail",
    tax_jurisdiction: "PK",
    tagline: "",
    primary_color: "",
    marketplace_description: "",
  });

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
      setForm({
        name: b.data.name || "",
        industry: b.data.industry || "retail",
        tax_jurisdiction: b.data.tax_jurisdiction || "PK",
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

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await api(`/businesses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry,
          tax_jurisdiction: form.tax_jurisdiction || "PK",
          tagline: form.tagline.trim() || null,
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

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await api(`/businesses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          tagline: form.tagline.trim() || null,
          primary_color: form.primary_color || null,
          marketplace_description: form.marketplace_description.trim() || null,
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

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await api(`/businesses/${id}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: branchName.trim(), timezone: "Asia/Karachi" }),
      });
      toast.success(t("businesses.branchCreated"));
      setBranchModal(false);
      setBranchName("");
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
              <form onSubmit={saveDetails} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
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
              </form>
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
                    setBranchName("");
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
              <form onSubmit={saveBranding} className="space-y-4">
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
                <Field label={t("businesses.tagline")}>
                  <input
                    className={fieldClass}
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  />
                </Field>
                <div className="text-xs text-body">
                  <span className="mb-1.5 block font-medium text-heading">
                    {t("businesses.brandColor")}
                  </span>
                  <BrandColorPicker
                    value={form.primary_color || null}
                    onChange={(hex) => {
                      setForm((f) => ({ ...f, primary_color: hex }));
                      previewStaffBrand(business.id, hex);
                    }}
                  />
                  <div
                    className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border bg-bg-secondary/60 p-4"
                    style={
                      form.primary_color
                        ? ({
                            ["--brand" as string]: form.primary_color,
                            ["--color-brand" as string]: form.primary_color,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                      style={{ backgroundColor: form.primary_color || "#1D4ED8" }}
                    >
                      {t("businesses.previewButton")}
                    </button>
                  </div>
                </div>
                <Field label={t("businesses.marketplaceDesc")}>
                  <textarea
                    className={fieldClass}
                    rows={3}
                    value={form.marketplace_description}
                    onChange={(e) =>
                      setForm({ ...form, marketplace_description: e.target.value })
                    }
                  />
                </Field>
                <Button type="submit" loading={busy}>
                  {t("businesses.saveBranding")}
                </Button>
              </form>
            </DetailSection>
          ) : null}
        </div>
      ) : null}

      <Modal
        isOpen={branchModal}
        onClose={() => setBranchModal(false)}
        title={t("businesses.addBranch")}
      >
        <form onSubmit={createBranch} className="space-y-4">
          <Field label={t("common.name")}>
            <input
              className={fieldClass}
              required
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setBranchModal(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={busy}>
              {t("common.create")}
            </Button>
          </div>
        </form>
      </Modal>
    </DetailShell>
  );
}
