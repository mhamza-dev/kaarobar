"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getSession } from "@/lib/api/client";
import { canAccessBundle } from "@/lib/rbac";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import {
  Field,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes, routes } from "@/lib/navigation";

type Business = {
  id: string;
  name: string;
  industry?: string | null;
  is_active?: boolean;
  tagline?: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
  marketplace_enabled?: boolean;
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

export default function BusinessesPage() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const session = getSession();
  const isOwner = canAccessBundle(session, "owner_manage");

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "general" });

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Business[] }>("/businesses");
      setBusinesses(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    if (isOwner) void load();
  }, [isOwner, load]);

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ data: Business }>("/businesses", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry || "general",
        }),
      });
      toast.success(t("businesses.created"));
      setModal(false);
      setForm({ name: "", industry: "general" });
      await load();
      if (res.data?.id) router.push(detailRoutes.business(res.data.id));
    } catch (err) {
      toast.error(planLimitMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("common.workspace")}
          title={t("pages.businessesTitle")}
          description={t("pages.businessesDesc")}
          infoKey="page.businesses"
        />
        <SurfaceCard className="p-5">
          <p className="text-sm text-body">{t("rbac.accessDeniedMessage")}</p>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("common.workspace")}
        title={t("pages.businessesTitle")}
        description={t("pages.businessesDesc")}
        infoKey="page.businesses"
        action={{
          label: t("businesses.new"),
          onClick: () => setModal(true),
        }}
        secondaryAction={{
          label: t("nav.settings"),
          onClick: () => {
            window.location.href = routes.settings;
          },
        }}
      />

      <DataTable
        maxHeight="28rem"
        searchable
        searchPlaceholder={t("businesses.search")}
        getSearchText={(b) => `${b.name} ${b.industry || ""} ${b.tagline || ""}`}
        onRowClick={(b) => router.push(detailRoutes.business(b.id))}
        columns={[
          {
            id: "name",
            header: t("common.name"),
            cell: (b) => (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card-muted text-sm font-bold text-heading"
                  style={
                    b.primary_color
                      ? { boxShadow: `inset 0 0 0 2px ${b.primary_color}` }
                      : undefined
                  }
                >
                  {b.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (b.name || "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <Link
                  href={detailRoutes.business(b.id)}
                  className="font-semibold text-brand underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {b.name}
                </Link>
              </div>
            ),
          },
          {
            id: "industry",
            header: t("businesses.industry"),
            cell: (b) => b.industry || "—",
          },
          {
            id: "marketplace",
            header: t("businesses.marketplace"),
            cell: (b) =>
              b.marketplace_enabled ? t("common.enabled") : t("common.disabled"),
          },
          {
            id: "status",
            header: t("common.status"),
            cell: (b) =>
              b.is_active === false
                ? t("businesses.inactive")
                : t("businesses.active"),
          },
        ]}
        data={businesses}
        rowKey={(b) => b.id}
        emptyTitle={t("businesses.emptyTitle")}
        emptyBody={t("businesses.emptyBody")}
      />

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={t("businesses.new")}
        footer={
          <Button type="submit" form="create-business-form" loading={busy}>
            {t("common.create")}
          </Button>
        }
      >
        <form id="create-business-form" onSubmit={createBusiness} className="grid gap-3">
          <Field label={t("businesses.name")}>
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
                  {t(`businesses.industries.${ind}`)}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
