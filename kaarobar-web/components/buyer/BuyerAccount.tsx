"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Gift,
  LogOut,
  Scale,
  UserRound,
  Wallet,
} from "lucide-react";
import { getSession, logoutSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import Button from "@/components/ui/Button";
import { BuyerCard, BuyerHero } from "@/components/buyer/BuyerLayout";
import { useT } from "@/lib/i18n";
import { useUnreadNotifications } from "@/lib/hooks/useUnreadNotifications";

const links = [
  {
    href: "/app/accounting",
    titleKey: "marketplace.accountBalance",
    bodyKey: "marketplace.accountBalanceBody",
    icon: Wallet,
  },
  {
    href: "/app/customers",
    titleKey: "marketplace.accountLoyalty",
    bodyKey: "marketplace.accountLoyaltyBody",
    icon: Gift,
  },
  {
    href: routes.notifications,
    titleKey: "marketplace.accountAlerts",
    bodyKey: "marketplace.accountAlertsBody",
    icon: Bell,
  },
] as const;

/** Buyer account hub — Balance, Loyalty, Alerts. */
export default function BuyerAccount() {
  const t = useT();
  const router = useRouter();
  const session = getSession();
  const { unread } = useUnreadNotifications();
  const initials = (session?.user.name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerAccountTitle")}
        description={t("pages.buyerAccountDesc")}
        infoKey="page.buyer.account"
      />

      <BuyerCard className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-brand text-lg font-bold text-white shadow-brand">
            {session?.user.profile_pic_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.profile_pic_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted" />
              <p className="truncate text-lg font-bold text-heading">
                {session?.user.name || t("marketplace.accountGuest")}
              </p>
            </div>
            <p className="mt-0.5 truncate text-sm text-body">
              {session?.user.email || session?.user.phone || ""}
            </p>
          </div>
        </div>
      </BuyerCard>

      <ul className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => {
          const Icon = item.icon;
          const isAlerts = item.href === routes.notifications;
          return (
            <li key={item.href}>
              <Link href={item.href} className="block h-full">
                <BuyerCard hover className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-soft text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    {isAlerts && unread > 0 ? (
                      <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-semibold text-heading">{t(item.titleKey)}</p>
                    <p className="mt-1 text-sm text-body">{t(item.bodyKey)}</p>
                  </div>
                  <span className="mt-auto pt-2 text-sm font-semibold text-brand">
                    {t("marketplace.viewDetails")} →
                  </span>
                </BuyerCard>
              </Link>
            </li>
          );
        })}
        <li>
          <BuyerCard className="flex h-full flex-col gap-3 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-bg-secondary text-muted">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-heading">{t("marketplace.accountKhataHint")}</p>
              <p className="mt-1 text-sm text-body">{t("marketplace.accountKhataHintBody")}</p>
            </div>
          </BuyerCard>
        </li>
      </ul>

      <Button
        variant="outline"
        className="w-full rounded-md sm:w-auto"
        startIcon={<LogOut className="h-4 w-4" />}
        onClick={() => {
          void logoutSession();
          router.push(routes.login);
        }}
      >
        {t("common.signOut")}
      </Button>
    </div>
  );
}
