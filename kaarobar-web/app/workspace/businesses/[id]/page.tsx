"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { api, getSession } from "@/lib/api/client";
import { canAccessBundle } from "@/lib/rbac";
import BrandColorPicker from "@/components/app/BrandColorPicker";
import {
  clearStaffBrandPreview,
  previewStaffBrand,
} from "@/components/app/BrandTheme";
import Button from "@/components/ui/Button";
import {
  Field,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { routes } from "@/lib/navigation";

type Business = {
  id: string;
  name: string;
  industry?: string | null;
  is_active?: boolean;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_enabled?: boolean;
  marketplace_slug?: string | null;
  marketplace_description?: string | null;
  online_branch_id?: string | null;
};

type Branch = {
  id: string;
  name: string;
  timezone?: string | null;
  is_active?: boolean;
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

function planLimitMessage(err: unknown, t: (key: string) => string): string {
  const code = err instanceof Error ? err.message : "";
  if (code === "plan_limit_reached") return t("businesses.planLimitReached");
  if (code === "subscription_inactive") return t("businesses.subscriptionInactive");
  return err instanceof Error ? err.message : t("common.error");
}

export default function BusinessDetailPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const session = getSession();
  const isOwner = canAccessBundle(session, "owner_manage");

  const [business, setBusiness] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [busy, setBusy] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [biz, br] = await Promise.all([
        api<{ data: Business }>(`/businesses/${id}`),
        api<{ data: Branch[] }>(`/businesses/${id}/branches?include_inactive=true`),
      ]);
      setBusiness(biz.data);
      setBranches(br.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  useEffect(() => {
    if (isOwner) void load();
    return () => clearStaffBrandPreview();
  }, [isOwner, load]);

  async function saveBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setBusy(true);
    try {
      const res = await api<{ data: Business }>(`/businesses/${business.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: business.name,
          industry: business.industry || null,
          tagline: business.tagline || null,
          primary_color: business.primary_color || null,
          marketplace_enabled: !!business.marketplace_enabled,
          marketplace_slug: business.marketplace_slug || null,
          marketplace_description: business.marketplace_description || null,
          online_branch_id:
            business.online_branch_id || session?.branch_id || null,
        }),
      });
      setBusiness(res.data);
      clearStaffBrandPreview();
      window.dispatchEvent(new Event("kaarobar:branding"));
      toast.success(t("businesses.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!business) return;
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await api<{ data: Business }>(`/businesses/${business.id}/logo`, {
        method: "POST",
        body: fd,
      });
      setBusiness(res.data);
      toast.success(t("businesses.logoUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function clearLogo() {
    if (!business) return;
    try {
      const res = await api<{ data: Business }>(`/businesses/${business.id}/logo`, {
        method: "DELETE",
      });
      setBusiness(res.data);
      toast.success(t("businesses.logoRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function createBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !branchName.trim()) return;
    setBusy(true);
    try {
      await api(`/businesses/${business.id}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: branchName.trim() }),
      });
      setBranchName("");
      toast.success(t("businesses.branchCreated"));
      await load();
    } catch (err) {
      toast.error(planLimitMessage(err, t));
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
    if (!confirm(t("businesses.deactivateConfirm", { name: business.name }))) {
      return;
    }
    setBusy(true);
    try {
      await api(`/businesses/${business.id}/deactivate`, {
        method: "POST",
        body: "{}",
      });
      toast.success(t("businesses.deactivated"));
      router.push(routes.businesses);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("nav.businesses")}
          title={t("pages.businessDetailTitle")}
          description={t("pages.businessDetailDesc")}
          infoKey="page.businessDetail"
        />
        <SurfaceCard className="p-5">
          <p className="text-sm text-body">{t("rbac.accessDeniedMessage")}</p>
        </SurfaceCard>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-body">{t("common.loading")}</p>;
  }

  if (!business) {
    return (
      <div className="space-y-4">
        <Link href={routes.businesses} className="text-sm font-semibold text-brand underline">
          {t("businesses.back")}
        </Link>
        <SurfaceCard className="p-5">
          <p className="text-sm text-body">{t("businesses.notFound")}</p>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("nav.businesses")}
        title={business.name}
        description={t("pages.businessDetailDesc")}
        infoKey="page.businessDetail"
        secondaryAction={{
          label: t("businesses.back"),
          onClick: () => router.push(routes.businesses),
        }}
      />

      {business.is_active === false ? (
        <SurfaceCard className="border-danger/40 bg-danger/5 p-4">
          <p className="text-sm font-medium text-heading">{t("businesses.inactiveBanner")}</p>
        </SurfaceCard>
      ) : null}

      <form onSubmit={saveBusiness} className="space-y-4">
        <SurfaceCard className="space-y-4 p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card-muted"
              style={
                business.primary_color
                  ? { boxShadow: `inset 0 0 0 2px ${business.primary_color}` }
                  : undefined
              }
            >
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
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
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="font-semibold text-heading">{t("businesses.branding")}</h2>
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
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-body hover:bg-bg-hover"
                  >
                    {t("businesses.removeLogo")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("businesses.name")}>
              <input
                className={fieldClass}
                required
                value={business.name}
                onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              />
            </Field>
            <Field label={t("businesses.industry")}>
              <select
                className={fieldClass}
                value={business.industry || "general"}
                onChange={(e) =>
                  setBusiness({ ...business, industry: e.target.value })
                }
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {t(`businesses.industries.${ind}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("businesses.tagline")}>
              <input
                className={fieldClass}
                value={business.tagline || ""}
                placeholder={t("businesses.taglinePlaceholder")}
                onChange={(e) =>
                  setBusiness({ ...business, tagline: e.target.value })
                }
              />
            </Field>
            <div className="text-xs text-body sm:col-span-2">
              <span className="mb-1.5 block font-medium text-heading">
                {t("businesses.brandColor")}
              </span>
              <BrandColorPicker
                value={business.primary_color}
                onChange={(hex) => {
                  setBusiness({ ...business, primary_color: hex });
                  previewStaffBrand(business.id, hex);
                }}
              />
              <div
                className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-bg-secondary/60 p-4"
                style={
                  business.primary_color
                    ? ({
                        ["--brand" as string]: business.primary_color,
                        ["--color-brand" as string]: business.primary_color,
                      } as CSSProperties)
                    : undefined
                }
              >
                <span className="w-full text-[11px] font-bold uppercase tracking-wide text-muted">
                  {t("businesses.livePreview")}
                </span>
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  style={{
                    backgroundColor: business.primary_color || "#1D4ED8",
                  }}
                >
                  {t("businesses.primaryButton")}
                </button>
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-3 p-5">
          <h2 className="font-semibold text-heading">{t("businesses.marketplace")}</h2>
          <label className="flex items-center gap-2 text-sm text-body">
            <input
              type="checkbox"
              checked={!!business.marketplace_enabled}
              onChange={(e) =>
                setBusiness({
                  ...business,
                  marketplace_enabled: e.target.checked,
                })
              }
            />
            {t("businesses.marketplaceListed")}
          </label>
          <Field label={t("businesses.marketplaceSlug")}>
            <input
              className={fieldClass}
              value={business.marketplace_slug || ""}
              placeholder="my-cafe"
              onChange={(e) =>
                setBusiness({ ...business, marketplace_slug: e.target.value })
              }
            />
          </Field>
          <Field label={t("businesses.marketplaceDescription")}>
            <textarea
              className={fieldClass}
              rows={3}
              value={business.marketplace_description || ""}
              placeholder={t("businesses.marketplaceDescriptionPlaceholder")}
              onChange={(e) =>
                setBusiness({
                  ...business,
                  marketplace_description: e.target.value,
                })
              }
            />
          </Field>
          <Field label={t("businesses.onlineBranch")}>
            <select
              className={fieldClass}
              value={business.online_branch_id || ""}
              onChange={(e) =>
                setBusiness({
                  ...business,
                  online_branch_id: e.target.value || null,
                })
              }
            >
              <option value="">{t("businesses.selectBranch")}</option>
              {branches
                .filter((b) => b.is_active !== false)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </Field>
        </SurfaceCard>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={busy}>
            {t("common.save")}
          </Button>
          {business.is_active !== false ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void deactivateBusiness()}
            >
              {t("businesses.deactivate")}
            </Button>
          ) : null}
        </div>
      </form>

      <SurfaceCard className="space-y-4 p-5">
        <h2 className="font-semibold text-heading">{t("settings.branches")}</h2>
        <form onSubmit={createBranch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Field label={t("businesses.branchName")}>
              <input
                className={fieldClass}
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={t("businesses.branchNamePlaceholder")}
              />
            </Field>
          </div>
          <Button type="submit" size="sm" loading={busy} disabled={!branchName.trim()}>
            {t("businesses.addBranch")}
          </Button>
        </form>
        <ul className="divide-y divide-border">
          {branches.length === 0 ? (
            <li className="py-3 text-sm text-body">{t("businesses.noBranches")}</li>
          ) : (
            branches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium text-heading">{b.name}</p>
                  <p className="text-xs text-muted">
                    {b.is_active === false
                      ? t("businesses.inactive")
                      : t("businesses.active")}
                    {b.timezone ? ` · ${b.timezone}` : ""}
                  </p>
                </div>
                {b.is_active !== false ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void deactivateBranch(b)}
                  >
                    {t("businesses.deactivate")}
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </SurfaceCard>
    </div>
  );
}
