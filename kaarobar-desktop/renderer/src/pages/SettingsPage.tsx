
import { useCallback, useEffect, useState } from "react";
import { api, getSession, setSession } from "@/lib/api/client";
import { PageHeader, SurfaceCard, TabBar } from "@/components/app/ui";
import NotificationPreferencesPanel from "@/components/app/NotificationPreferencesPanel";
import BrandColorPicker from "@/components/app/BrandColorPicker";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

type Usage = {
  subscription: {
    plan: string;
    status: string;
    max_businesses: number;
    max_branches: number;
    max_users: number;
    trial_ends_at?: string;
    current_period_end?: string;
  };
  usage: { businesses: number; branches: number; users: number };
  limits: { max_businesses: number; max_branches: number; max_users: number };
  checkout_url?: string | null;
};

type Business = {
  id: string;
  name: string;
  fbr_tier1?: boolean;
  loyalty_earn_per_amount?: string;
  loyalty_points_per_earn?: number;
  loyalty_redeem_value?: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  marketplace_description?: string | null;
};
type RoleSettings = Record<string, Record<string, boolean>>;
type SettingsTab = "subscriptions" | "integrations" | "branding" | "roles" | "notifications";
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

export default function SettingsPage() {
  const t = useT();
  const toast = useToast();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [roleSettings, setRoleSettings] = useState<RoleSettings>({});
  const [savingRoles, setSavingRoles] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("notifications");

  const session = getSession();
  const isOwner = (session?.memberships || [])
    .filter((m) => m.business_id === session?.business_id && m.status === "active")
    .some((m) => (m.roles || []).includes("owner"));
  const activeBusiness =
    businesses.find((b) => b.id === session?.business_id) || null;

  const load = useCallback(async () => {
    try {
      if (!isOwner) return;
      const [bill, biz] = await Promise.all([
        api<{ data: Usage }>("/billing/subscription"),
        api<{ data: Business[] }>("/businesses"),
      ]);
      setUsage(bill.data);
      setBusinesses(biz.data || []);
      if (session?.business_id) {
        const roleRes = await api<{ data: { roles: RoleSettings } }>(
          `/businesses/${session.business_id}/role-settings`
        );
        setRoleSettings(roleRes.data?.roles || {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.loadFailed"));
    }
  }, [isOwner, session?.business_id, t, toast]);

  useEffect(() => {
    if (isOwner) void load();
    else setTab("notifications");
  }, [isOwner, load]);

  async function toggleFbr(b: Business) {
    try {
      await api(`/businesses/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fbr_tier1: !b.fbr_tier1 }),
      });
      toast.success(
        t(!b.fbr_tier1 ? "settings.fbrEnabled" : "settings.fbrDisabled", {
          name: b.name,
        })
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.updateFailed"));
    }
  }

  async function saveLoyalty(b: Business) {
    try {
      await api(`/businesses/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          loyalty_earn_per_amount: b.loyalty_earn_per_amount || "100",
          loyalty_points_per_earn: Number(b.loyalty_points_per_earn || 1),
          loyalty_redeem_value: b.loyalty_redeem_value || "1.00",
        }),
      });
      toast.success(t("settings.loyaltySaved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function saveBranding(b: Business) {
    try {
      await api(`/businesses/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: b.name,
          tagline: b.tagline || null,
          primary_color: b.primary_color || null,
          marketplace_description: b.marketplace_description || null,
        }),
      });
      toast.success("Branding saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function uploadLogo(b: Business, file: File) {
    try {
      const fd = new FormData();
      fd.append("logo", file);
      await api(`/businesses/${b.id}/logo`, { method: "POST", body: fd });
      toast.success("Logo updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  async function clearLogo(b: Business) {
    try {
      await api(`/businesses/${b.id}/logo`, { method: "DELETE" });
      toast.success("Logo removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
    }
  }

  const sub = usage?.subscription;

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
      if (session) setSession({ ...session, role_settings: nextRoles });
      toast.success("Role settings saved");
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

  const tabs: {
    key: SettingsTab;
    label: string;
    ownerOnly?: boolean;
    infoKey: string;
  }[] = [
    { key: "notifications", label: "Notifications", infoKey: "tab.settings.notifications" },
    {
      key: "subscriptions",
      label: "Subscriptions",
      ownerOnly: true,
      infoKey: "tab.settings.subscriptions",
    },
    {
      key: "integrations",
      label: "Integrations",
      ownerOnly: true,
      infoKey: "tab.settings.integrations",
    },
    {
      key: "branding",
      label: "Branding",
      ownerOnly: true,
      infoKey: "tab.settings.branding",
    },
    { key: "roles", label: "Roles", ownerOnly: true, infoKey: "tab.settings.roles" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("common.workspace")}
        title={t("pages.settingsTitle")}
        description={t("pages.settingsDesc")}
        infoKey="page.settings"
      />

      <TabBar
        tabs={tabs
          .filter((item) => !item.ownerOnly || isOwner)
          .map((item) => ({ id: item.key, label: item.label, infoKey: item.infoKey }))}
        value={tab}
        onChange={setTab}
        aria-label="Settings sections"
      />

      {tab === "notifications" ? <NotificationPreferencesPanel /> : null}

      {tab === "subscriptions" && isOwner && sub ? (
        <SurfaceCard className="p-5">
          <h2 className="font-semibold text-heading">{t("settings.subscription")}</h2>
          <p className="mt-1 text-body">
            {t("settings.plan")}{" "}
            <strong className="text-heading">{sub.plan}</strong> · {sub.status}
          </p>
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
          ) : (
            <p className="mt-4 text-sm text-body">{t("settings.billingNotConfigured")}</p>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "integrations" && isOwner ? (
        <div className="space-y-4">
          <SurfaceCard className="flex flex-col p-5">
            <h2 className="shrink-0 font-semibold text-heading">{t("settings.fbrTitle")}</h2>
            <p className="mt-1 shrink-0 text-sm text-body">{t("settings.fbrDesc")}</p>
            <ul className="mt-4 max-h-[min(28rem,50vh)] space-y-0 overflow-y-auto">
              {businesses.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 first:border-t-0"
                >
                  <span className="font-medium text-heading">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleFbr(b)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      b.fbr_tier1
                        ? "bg-brand text-brand-foreground"
                        : "border border-border text-heading hover:bg-bg-hover"
                    }`}
                  >
                    {b.fbr_tier1 ? t("common.enabled") : t("common.disabled")}
                  </button>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard className="space-y-3 p-5">
            <h2 className="font-semibold text-heading">{t("settings.loyaltyTitle")}</h2>
            <p className="text-sm text-body">{t("settings.loyaltyDesc")}</p>
            {businesses.map((b) => (
              <div
                key={`loyalty-${b.id}`}
                className="grid gap-2 border-t border-border pt-3 sm:grid-cols-4"
              >
                <span className="font-medium text-heading sm:col-span-4">{b.name}</span>
                <label className="text-xs text-body">
                  {t("settings.loyaltyEarnPerAmount")}
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                    value={b.loyalty_earn_per_amount || "100"}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === b.id
                            ? { ...x, loyalty_earn_per_amount: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </label>
                <label className="text-xs text-body">
                  {t("settings.loyaltyPointsPerEarn")}
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                    type="number"
                    value={b.loyalty_points_per_earn ?? 1}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === b.id
                            ? { ...x, loyalty_points_per_earn: Number(e.target.value) }
                            : x
                        )
                      )
                    }
                  />
                </label>
                <label className="text-xs text-body">
                  {t("settings.loyaltyRedeemValue")}
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                    value={b.loyalty_redeem_value || "1.00"}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === b.id
                            ? { ...x, loyalty_redeem_value: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveLoyalty(b)}
                  className="self-end rounded-md bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground"
                >
                  {t("common.save")}
                </button>
              </div>
            ))}
          </SurfaceCard>
        </div>
      ) : null}

      {tab === "branding" && isOwner ? (
        <div className="space-y-4">
          {!activeBusiness ? (
            <SurfaceCard className="p-5">
              <p className="text-sm text-body">
                Switch to a business workspace to edit its branding.
              </p>
            </SurfaceCard>
          ) : (
            <SurfaceCard className="space-y-4 p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card-muted">
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
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="font-semibold text-heading">{activeBusiness.name}</h2>
                  <p className="text-sm text-body">
                    Used on the customer marketplace and marketing templates.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium text-heading hover:bg-bg-hover">
                      Upload logo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadLogo(activeBusiness, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {activeBusiness.logo_url ? (
                      <button
                        type="button"
                        onClick={() => void clearLogo(activeBusiness)}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-body"
                      >
                        Remove logo
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-body">
                  Business name
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                    value={activeBusiness.name}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === activeBusiness.id
                            ? { ...x, name: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </label>
                <label className="text-xs text-body">
                  Tagline
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                    value={activeBusiness.tagline || ""}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === activeBusiness.id
                            ? { ...x, tagline: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </label>
                <div className="text-xs text-body sm:col-span-2">
                  <span className="mb-1.5 block font-medium text-heading">Brand color</span>
                  <BrandColorPicker
                    value={activeBusiness.primary_color}
                    onChange={(hex) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === activeBusiness.id
                            ? { ...x, primary_color: hex }
                            : x
                        )
                      )
                    }
                  />
                </div>
                <label className="text-xs text-body sm:col-span-2">
                  Marketplace description
                  <textarea
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
                    rows={3}
                    value={activeBusiness.marketplace_description || ""}
                    onChange={(e) =>
                      setBusinesses((prev) =>
                        prev.map((x) =>
                          x.id === activeBusiness.id
                            ? { ...x, marketplace_description: e.target.value }
                            : x
                        )
                      )
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveBranding(activeBusiness)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
              >
                Save branding
              </button>
            </SurfaceCard>
          )}
        </div>
      ) : null}

      {tab === "roles" && isOwner ? (
        <SurfaceCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-heading">Role Settings</h2>
              <p className="mt-1 text-sm text-body">
                Owner can allow or restrict module access for each role.
              </p>
            </div>
            <button
              type="button"
              onClick={saveRoleSettings}
              disabled={savingRoles}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
            >
              {savingRoles ? "Saving..." : "Save Roles"}
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-body">
                  <th className="px-3 py-2">Role</th>
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
