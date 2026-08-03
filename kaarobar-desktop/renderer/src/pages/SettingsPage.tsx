import { Suspense, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession, setSession } from "@/lib/api/client";
import { PageHeader, SurfaceCard, TabBar, fieldClass } from "@/components/app/ui";
import NotificationPreferencesPanel from "@/components/app/NotificationPreferencesPanel";
import ProfileSettingsPanel from "@/components/app/ProfileSettingsPanel";
import BrandColorPicker from "@/components/app/BrandColorPicker";
import {
  clearStaffBrandPreview,
  previewStaffBrand,
} from "@/components/app/BrandTheme";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";
import { planAllowsFbr } from "@/lib/rbac";
import { settingsKeys } from "@/lib/queryClient";
import type { CSSProperties } from "react";

type Plan = {
  code: string;
  name: string;
  max_businesses: number;
  max_branches: number;
  max_users: number;
  price_display?: string | null;
  price_pkr?: number | null;
  billing_period?: string | null;
  tagline?: string | null;
  features?: string[];
  lemon_variant_id?: string | null;
  checkout_available?: boolean;
  sort_order?: number;
};

function formatPlanPrice(
  plan: Plan,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  if (plan.code === "trial" || plan.billing_period === "trial") {
    return t("settings.planPriceFree");
  }
  if (plan.billing_period === "custom" || plan.price_pkr == null) {
    return plan.price_display || t("settings.planPriceCustom");
  }
  if (plan.price_pkr === 0) {
    return t("settings.planPriceFree");
  }
  const amount = plan.price_pkr.toLocaleString("en-PK");
  return t("settings.planPriceMonth", { amount });
}

type Usage = {
  subscription: {
    plan: string;
    status: string;
    max_businesses: number;
    max_branches: number;
    max_users: number;
    trial_ends_at?: string;
    current_period_end?: string;
    allows_writes?: boolean;
    allows_fbr?: boolean;
  };
  usage: { businesses: number; branches: number; users: number };
  limits: { max_businesses: number; max_branches: number; max_users: number };
  allows_writes?: boolean;
  allows_fbr?: boolean;
  entitled_bundles?: string[];
  plans?: Plan[];
  checkout_url?: string | null;
};

type Business = {
  id: string;
  name: string;
  fbr_tier1?: boolean;
  loyalty_earn_per_amount?: string;
  loyalty_points_per_earn?: number;
  loyalty_redeem_value?: string;
  marketplace_enabled?: boolean;
  marketplace_slug?: string | null;
  online_branch_id?: string | null;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
};
type RoleSettings = Record<string, Record<string, boolean>>;
type SettingsTab =
  | "profile"
  | "subscriptions"
  | "integrations"
  | "branding"
  | "roles"
  | "notifications";

const MANAGED_ROLES = ["owner", "admin", "employee", "marketing"] as const;
const MANAGED_BUNDLES = [
  "pos",
  "pos_approve",
  "inventory",
  "accounting",
  "customers",
  "marketing",
  "hr",
  "leave_approve",
  "payroll_approve",
  "reports",
  "settings",
  "notifications",
  "employee_self",
] as const;

const ALL_TABS: SettingsTab[] = [
  "profile",
  "notifications",
  "subscriptions",
  "integrations",
  "branding",
  "roles",
];

const OWNER_ONLY_TABS = new Set<SettingsTab>([
  "subscriptions",
  "integrations",
  "branding",
  "roles",
]);

function SettingsPageInner() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [savingRoles, setSavingRoles] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [roleSettings, setRoleSettings] = useState<RoleSettings>({});

  const session = getSession();
  const ownerId = session?.user?.id ?? null;
  const isOwner = (session?.memberships || [])
    .filter((m) => m.business_id === session?.business_id && m.status === "active")
    .some((m) => (m.roles || []).includes("owner"));

  const needBilling =
    isOwner && (tab === "subscriptions" || tab === "integrations");
  const needBusinesses = isOwner && (tab === "integrations" || tab === "branding");
  const needRoles = tab === "roles" && isOwner;

  const { data: usage = null } = useQuery({
    queryKey: settingsKeys.billing(ownerId),
    queryFn: async () => {
      const res = await api<{ data: Usage }>("/billing/subscription");
      return res.data;
    },
    enabled: needBilling,
  });

  const { data: businesses = [] } = useQuery({
    queryKey: settingsKeys.businesses(ownerId),
    queryFn: async () => {
      const res = await api<{ data: Business[] }>("/businesses");
      return res.data || [];
    },
    enabled: needBusinesses,
  });

  const { data: roleSettingsRemote } = useQuery({
    queryKey: settingsKeys.roleSettings(session?.business_id),
    queryFn: async () => {
      const res = await api<{ data: { roles: RoleSettings } }>(
        `/businesses/${session!.business_id}/role-settings`
      );
      return res.data?.roles || {};
    },
    enabled: needRoles && !!session?.business_id,
  });

  useEffect(() => {
    if (roleSettingsRemote) setRoleSettings(roleSettingsRemote);
  }, [roleSettingsRemote]);

  const canUseFbr =
    planAllowsFbr(session) || Boolean(usage?.allows_fbr);
  const activeBusiness =
    businesses.find((b) => b.id === session?.business_id) || null;

  const tabs: {
    key: SettingsTab;
    label: string;
    ownerOnly?: boolean;
    infoKey: string;
  }[] = [
    { key: "profile", label: t("settings.tabProfile"), infoKey: "tab.settings.profile" },
    {
      key: "notifications",
      label: t("settings.tabNotifications"),
      infoKey: "tab.settings.notifications",
    },
    {
      key: "subscriptions",
      label: t("settings.tabSubscriptions"),
      ownerOnly: true,
      infoKey: "tab.settings.subscriptions",
    },
    {
      key: "integrations",
      label: t("settings.tabIntegrations"),
      ownerOnly: true,
      infoKey: "tab.settings.integrations",
    },
    {
      key: "branding",
      label: t("settings.tabBranding"),
      ownerOnly: true,
      infoKey: "tab.settings.branding",
    },
    {
      key: "roles",
      label: t("settings.tabRoles"),
      ownerOnly: true,
      infoKey: "tab.settings.roles",
    },
  ];

  const visibleTabs = tabs.filter((item) => !item.ownerOnly || isOwner);

  const changeTab = useCallback(
    (next: SettingsTab) => {
      const allowed = !OWNER_ONLY_TABS.has(next) || isOwner;
      const resolved = allowed ? next : "profile";
      setTab(resolved);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", resolved);
      navigate(`/app/settings?${params.toString()}`, { replace: true });
    },
    [isOwner, navigate, searchParams]
  );

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (!raw || !ALL_TABS.includes(raw as SettingsTab)) return;
    const next = raw as SettingsTab;
    const allowed = !OWNER_ONLY_TABS.has(next) || isOwner;
    setTab(allowed ? next : "profile");
  }, [isOwner, searchParams]);

  async function refreshSettings() {
    await queryClient.invalidateQueries({ queryKey: settingsKeys.all });
  }

  useEffect(() => {
    return () => clearStaffBrandPreview();
  }, []);

  function patchActive(patch: Partial<Business>) {
    if (!activeBusiness) return;
    queryClient.setQueryData(
      settingsKeys.businesses(ownerId),
      (prev: Business[] | undefined) =>
        (prev || []).map((x) =>
          x.id === activeBusiness.id ? { ...x, ...patch } : x
        )
    );
  }

  async function toggleFbr() {
    if (!activeBusiness) return;
    try {
      await api(`/businesses/${activeBusiness.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fbr_tier1: !activeBusiness.fbr_tier1 }),
      });
      toast.success(
        t(!activeBusiness.fbr_tier1 ? "settings.fbrEnabled" : "settings.fbrDisabled", {
          name: activeBusiness.name,
        })
      );
      await refreshSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
    }
  }

  async function saveLoyalty() {
    if (!activeBusiness) return;
    try {
      await api(`/businesses/${activeBusiness.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          loyalty_earn_per_amount: activeBusiness.loyalty_earn_per_amount || "100",
          loyalty_points_per_earn: Number(activeBusiness.loyalty_points_per_earn || 1),
          loyalty_redeem_value: activeBusiness.loyalty_redeem_value || "1.00",
        }),
      });
      toast.success(t("settings.loyaltySaved"));
      await refreshSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function saveMarketplace() {
    if (!activeBusiness) return;
    try {
      await api(`/businesses/${activeBusiness.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          marketplace_enabled: !!activeBusiness.marketplace_enabled,
          marketplace_slug: activeBusiness.marketplace_slug || null,
          online_branch_id: activeBusiness.online_branch_id || session?.branch_id || null,
        }),
      });
      toast.success(t("settings.marketplaceSaved"));
      await refreshSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function saveBranding() {
    if (!activeBusiness) return;
    try {
      await api(`/businesses/${activeBusiness.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: activeBusiness.name,
          tagline: activeBusiness.tagline || null,
          primary_color: activeBusiness.primary_color || null,
          marketplace_description: activeBusiness.marketplace_description || null,
        }),
      });
      toast.success(t("settings.brandingSaved"));
      clearStaffBrandPreview();
      window.dispatchEvent(new Event("kaarobar:branding"));
      await refreshSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function uploadLogo(file: File) {
    if (!activeBusiness) return;
    try {
      const fd = new FormData();
      fd.append("logo", file);
      await api(`/businesses/${activeBusiness.id}/logo`, { method: "POST", body: fd });
      toast.success(t("settings.logoUpdated"));
      await refreshSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function clearLogo() {
    if (!activeBusiness) return;
    try {
      await api(`/businesses/${activeBusiness.id}/logo`, { method: "DELETE" });
      toast.success(t("settings.logoRemoved"));
      await refreshSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function upgradePlan(plan: Plan) {
    if (plan.code === "trial") return;
    if (plan.checkout_available === false) {
      toast.error(t("settings.contactSales"));
      return;
    }
    setCheckoutBusy(plan.code);
    try {
      const res = await api<{ data: { checkout_url: string } }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: plan.code,
          redirect_url: window.location.href,
        }),
      });
      if (res.data?.checkout_url) {
        window.open(res.data.checkout_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(
          plan.code === "enterprise" ? t("settings.contactSales") : t("settings.billingNotConfigured")
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      if (plan.code === "enterprise" || /not_configured|invalid_plan/i.test(message)) {
        toast.error(t("settings.contactSales"));
      } else {
        toast.error(message);
      }
    } finally {
      setCheckoutBusy(null);
    }
  }

  const sub = usage?.subscription;
  const allowsWrites = usage?.allows_writes ?? sub?.allows_writes ?? true;
  const plans = [...(usage?.plans || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  async function saveRoleSettings() {
    if (!session?.business_id || !isOwner) return;
    setSavingRoles(true);
    try {
      const res = await api<{ data: { roles: RoleSettings } }>(
        `/businesses/${session.business_id}/role-settings`,
        {
          method: "PUT",
          body: JSON.stringify({ roles: roleSettings }),
        }
      );
      const nextRoles = res.data?.roles || roleSettings;
      setRoleSettings(nextRoles);
      queryClient.setQueryData(
        settingsKeys.roleSettings(session.business_id),
        nextRoles
      );
      if (session) setSession({ ...session, role_settings: nextRoles });
      toast.success(t("settings.rolesSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    } finally {
      setSavingRoles(false);
    }
  }

  function toggleRoleBundle(role: string, bundle: string) {
    setRoleSettings((prev) => {
      const roleMap = prev[role] || {};
      return {
        ...prev,
        [role]: {
          ...roleMap,
          [bundle]: !(roleMap[bundle] ?? false),
        },
      };
    });
  }

  const manageHref = activeBusiness
    ? detailRoutes.business(activeBusiness.id)
    : "/app/businesses";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("common.workspace")}
        title={t("pages.settingsTitle")}
        description={t("pages.settingsDesc")}
        infoKey="page.settings"
      />

      <TabBar
        tabs={visibleTabs.map((item) => ({
          id: item.key,
          label: item.label,
          infoKey: item.infoKey,
        }))}
        value={tab}
        onChange={changeTab}
        aria-label="Settings sections"
      />

      {tab === "profile" ? <ProfileSettingsPanel /> : null}

      {tab === "notifications" ? <NotificationPreferencesPanel /> : null}

      {tab === "subscriptions" && isOwner && sub ? (
        <div className="space-y-4">
          {!allowsWrites ? (
            <SurfaceCard className="border-warning/40 bg-warning/5 p-4">
              <p className="text-sm font-medium text-heading">
                {t("settings.writesDisabledBanner")}
              </p>
              <p className="mt-1 text-sm text-body">{t("settings.writesDisabledHint")}</p>
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="p-5">
            <h2 className="font-semibold text-heading">{t("settings.subscription")}</h2>
            <p className="mt-1 text-body">
              {t("settings.plan")}{" "}
              <strong className="text-heading">{sub.plan}</strong> · {sub.status}
            </p>
            <p className="mt-2 text-sm text-body">{t("settings.billingHint")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(
                [
                  [t("settings.businesses"), usage!.usage.businesses, usage!.limits.max_businesses],
                  [t("settings.branches"), usage!.usage.branches, usage!.limits.max_branches],
                  [t("settings.users"), usage!.usage.users, usage!.limits.max_users],
                ] as const
              ).map(([label, used, max]) => (
                <div key={label} className="rounded-md border border-border bg-card-muted p-3">
                  <p className="text-sm text-body">{label}</p>
                  <p className="text-lg font-semibold text-heading">
                    {used} / {max}
                  </p>
                </div>
              ))}
            </div>
            {usage?.checkout_url ? (
              <a
                href={usage.checkout_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
              >
                {t("settings.manageBilling")}
              </a>
            ) : null}
          </SurfaceCard>

          {plans.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => {
                const current = plan.code === sub.plan;
                const features =
                  plan.features && plan.features.length > 0
                    ? plan.features
                    : [
                        `${t("settings.businesses")}: ${plan.max_businesses}`,
                        `${t("settings.branches")}: ${plan.max_branches}`,
                        `${t("settings.users")}: ${plan.max_users}`,
                      ];
                return (
                  <SurfaceCard
                    key={plan.code}
                    className={`flex flex-col p-5 ${current ? "ring-2 ring-brand" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-heading">{plan.name}</h3>
                        <p className="mt-1 text-sm font-medium text-heading">
                          {formatPlanPrice(plan, t)}
                        </p>
                        {plan.tagline ? (
                          <p className="mt-2 text-sm text-body">{plan.tagline}</p>
                        ) : null}
                      </div>
                      {current ? (
                        <span className="shrink-0 rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                          {t("settings.currentPlan")}
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-4 flex-1 space-y-1.5 text-sm text-body">
                      {features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span aria-hidden className="text-brand">
                            •
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {!current && plan.code !== "trial" ? (
                      <Button
                        className="mt-4"
                        loading={checkoutBusy === plan.code}
                        onClick={() => void upgradePlan(plan)}
                      >
                        {plan.checkout_available === false
                          ? t("settings.contactSales")
                          : t("settings.getStarted")}
                      </Button>
                    ) : null}
                  </SurfaceCard>
                );
              })}
            </div>
          ) : (
            <SurfaceCard className="p-5">
              <p className="text-sm text-body">{t("settings.billingNotConfigured")}</p>
            </SurfaceCard>
          )}
        </div>
      ) : null}

      {tab === "integrations" && isOwner ? (
        <div className="space-y-4">
          <SurfaceCard className="p-4">
            <p className="text-sm text-body">
              {t("settings.activeBusinessOnly")}{" "}
              <Link to={manageHref} className="font-semibold text-brand underline">
                {t("settings.manageBusinessFull")}
              </Link>
            </p>
          </SurfaceCard>

          {!activeBusiness ? (
            <SurfaceCard className="p-5">
              <p className="text-sm text-body">{t("settings.switchBusinessHint")}</p>
            </SurfaceCard>
          ) : (
            <>
              {canUseFbr ? (
              <SurfaceCard className="flex flex-col p-5">
                <h2 className="shrink-0 font-semibold text-heading">{t("settings.fbrTitle")}</h2>
                <p className="mt-1 shrink-0 text-sm text-body">{t("settings.fbrDesc")}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="font-medium text-heading">{activeBusiness.name}</span>
                  <button
                    type="button"
                    onClick={() => void toggleFbr()}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      activeBusiness.fbr_tier1
                        ? "bg-brand text-brand-foreground"
                        : "border border-border text-heading hover:bg-bg-hover"
                    }`}
                  >
                    {activeBusiness.fbr_tier1 ? t("common.enabled") : t("common.disabled")}
                  </button>
                </div>
              </SurfaceCard>
              ) : null}

              <SurfaceCard className="space-y-3 p-5">
                <h2 className="font-semibold text-heading">{t("settings.loyaltyTitle")}</h2>
                <p className="text-sm text-body">{t("settings.loyaltyDesc")}</p>
                <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-4">
                  <span className="font-medium text-heading sm:col-span-4">
                    {activeBusiness.name}
                  </span>
                  <label className="text-xs text-body">
                    {t("settings.loyaltyEarnPerAmount")}
                    <input
                      className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                      value={activeBusiness.loyalty_earn_per_amount || "100"}
                      onChange={(e) =>
                        patchActive({ loyalty_earn_per_amount: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-xs text-body">
                    {t("settings.loyaltyPointsPerEarn")}
                    <input
                      className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                      type="number"
                      value={activeBusiness.loyalty_points_per_earn ?? 1}
                      onChange={(e) =>
                        patchActive({
                          loyalty_points_per_earn: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-body">
                    {t("settings.loyaltyRedeemValue")}
                    <input
                      className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                      value={activeBusiness.loyalty_redeem_value || "1.00"}
                      onChange={(e) =>
                        patchActive({ loyalty_redeem_value: e.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveLoyalty()}
                    className="self-end rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </SurfaceCard>

              <SurfaceCard className="space-y-3 p-5">
                <h2 className="font-semibold text-heading">{t("settings.marketplaceTitle")}</h2>
                <p className="text-sm text-body">{t("settings.marketplaceDesc")}</p>
                <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                  <span className="font-medium text-heading sm:col-span-3">
                    {activeBusiness.name}
                  </span>
                  <label className="flex items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={!!activeBusiness.marketplace_enabled}
                      onChange={(e) =>
                        patchActive({ marketplace_enabled: e.target.checked })
                      }
                    />
                    {t("settings.marketplaceListed")}
                  </label>
                  <label className="text-xs text-body">
                    {t("settings.marketplaceSlug")}
                    <input
                      className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                      value={activeBusiness.marketplace_slug || ""}
                      placeholder="my-cafe"
                      onChange={(e) =>
                        patchActive({ marketplace_slug: e.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveMarketplace()}
                    className="self-end rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </SurfaceCard>
            </>
          )}
        </div>
      ) : null}

      {tab === "branding" && isOwner ? (
        <div className="space-y-4">
          <SurfaceCard className="p-4">
            <p className="text-sm text-body">
              {t("settings.activeBusinessOnly")}{" "}
              <Link to={manageHref} className="font-semibold text-brand underline">
                {t("settings.manageBusinessFull")}
              </Link>
            </p>
          </SurfaceCard>
          {!activeBusiness ? (
            <SurfaceCard className="p-5">
              <p className="text-sm text-body">{t("settings.switchBusinessHint")}</p>
            </SurfaceCard>
          ) : (
            <SurfaceCard className="space-y-4 p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card-muted"
                  style={
                    activeBusiness.primary_color
                      ? { boxShadow: `inset 0 0 0 2px ${activeBusiness.primary_color}` }
                      : undefined
                  }
                >
                  {activeBusiness.logo_url ? (
                    <img
                      src={activeBusiness.logo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-heading">
                      {(activeBusiness.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <h2 className="font-semibold text-heading">{activeBusiness.name}</h2>
                  <p className="text-sm text-body">{t("settings.brandingDesc")}</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium text-heading hover:bg-bg-hover">
                      {t("settings.uploadLogo")}
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
                    {activeBusiness.logo_url ? (
                      <button
                        type="button"
                        onClick={() => void clearLogo()}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-body hover:bg-bg-hover"
                      >
                        {t("settings.removeLogo")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-body">
                  {t("settings.businessName")}
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm text-heading"
                    value={activeBusiness.name}
                    onChange={(e) => patchActive({ name: e.target.value })}
                  />
                </label>
                <label className="text-xs text-body">
                  {t("settings.tagline")}
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm text-heading"
                    value={activeBusiness.tagline || ""}
                    placeholder="Fresh daily · Est. 2012"
                    onChange={(e) => patchActive({ tagline: e.target.value })}
                  />
                </label>
                <div className="text-xs text-body sm:col-span-2">
                  <span className="mb-1.5 block font-medium text-heading">
                    {t("settings.brandColor")}
                  </span>
                  <div className="space-y-4">
                    <BrandColorPicker
                      value={activeBusiness.primary_color}
                      onChange={(hex) => {
                        patchActive({ primary_color: hex });
                        previewStaffBrand(activeBusiness.id, hex);
                      }}
                    />
                    <div
                      className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-border bg-bg-secondary/60 p-4"
                      style={
                        activeBusiness.primary_color
                          ? ({
                              ["--brand" as string]: activeBusiness.primary_color,
                              ["--color-brand" as string]:
                                activeBusiness.primary_color,
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      <span className="w-full text-[11px] font-bold uppercase tracking-wide text-muted">
                        {t("settings.livePreview")}
                      </span>
                      <button
                        type="button"
                        className="rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
                        style={{
                          backgroundColor:
                            activeBusiness.primary_color || "#1D4ED8",
                        }}
                      >
                        {t("settings.primaryButton")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                        style={{
                          backgroundColor:
                            activeBusiness.primary_color || "#1D4ED8",
                        }}
                      >
                        {t("settings.navSample")}
                      </button>
                      <input
                        className={`${fieldClass} max-w-[12rem]`}
                        style={{
                          borderColor: activeBusiness.primary_color || undefined,
                          boxShadow: activeBusiness.primary_color
                            ? `0 0 0 2px ${activeBusiness.primary_color}33`
                            : undefined,
                        }}
                        placeholder={t("settings.focusMe")}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                <label className="text-xs text-body sm:col-span-2">
                  {t("settings.marketplaceDescription")}
                  <textarea
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm text-heading"
                    rows={3}
                    value={activeBusiness.marketplace_description || ""}
                    placeholder={t("settings.marketplaceDescriptionPlaceholder")}
                    onChange={(e) =>
                      patchActive({ marketplace_description: e.target.value })
                    }
                  />
                </label>
              </div>
              <Button
                type="button"
                onClick={() => void saveBranding()}
                style={{
                  backgroundColor: activeBusiness.primary_color || undefined,
                  borderColor: activeBusiness.primary_color || undefined,
                }}
              >
                {t("settings.saveBranding")}
              </Button>
            </SurfaceCard>
          )}
        </div>
      ) : null}

      {tab === "roles" && isOwner ? (
        <SurfaceCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-heading">{t("settings.rolesTitle")}</h2>
              <p className="mt-1 text-sm text-body">{t("settings.rolesDesc")}</p>
            </div>
            <button
              type="button"
              onClick={() => void saveRoleSettings()}
              disabled={savingRoles}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
            >
              {savingRoles ? t("common.loading") : t("settings.saveRoles")}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-body">
                  <th className="px-3 py-2">{t("settings.roleColumn")}</th>
                  {MANAGED_BUNDLES.map((bundle) => (
                    <th key={bundle} className="px-3 py-2 capitalize">
                      {bundle}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MANAGED_ROLES.map((role) => (
                  <tr key={role} className="border-b border-border">
                    <td className="px-3 py-2 font-medium capitalize text-heading">{role}</td>
                    {MANAGED_BUNDLES.map((bundle) => {
                      const checked = roleSettings[role]?.[bundle] ?? false;
                      return (
                        <td key={bundle} className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRoleBundle(role, bundle)}
                            disabled={role === "owner" && bundle !== "notifications"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-body">Loading…</p>}>
      <SettingsPageInner />
    </Suspense>
  );
}
