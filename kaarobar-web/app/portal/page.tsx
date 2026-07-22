"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPortalSession, portalApi } from "@/lib/portal-api";

export default function PortalHomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [points, setPoints] = useState(0);
  const [balance, setBalance] = useState("0");

  useEffect(() => {
    const session = getPortalSession();
    if (!session) {
      router.replace("/portal/login");
      return;
    }
    void (async () => {
      try {
        const [me, loyalty, ar] = await Promise.all([
          portalApi<{ data: { customer: { name: string } } }>("/portal/me"),
          portalApi<{ data: { points: number } }>("/portal/loyalty"),
          portalApi<{ data: { balance: string } }>("/portal/ar"),
        ]);
        setName(me.data.customer.name);
        setPoints(loyalty.data.points);
        setBalance(ar.data.balance);
      } catch {
        router.replace("/portal/login");
      }
    })();
  }, [router]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-heading">Hello{name ? `, ${name}` : ""}</h1>
        <p className="mt-2 text-body">Your purchases, loyalty, and shop balance in one place.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/portal/loyalty" className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Loyalty</p>
          <p className="mt-2 text-2xl font-bold text-heading">{points} pts</p>
        </Link>
        <Link href="/portal/ar" className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Khata balance</p>
          <p className="mt-2 text-2xl font-bold text-heading">Rs {balance}</p>
        </Link>
        <Link href="/portal/orders" className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Orders</p>
          <p className="mt-2 text-2xl font-bold text-heading">View history</p>
        </Link>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-white/70 p-5 text-sm text-body">
        Appointment booking is not available yet (Phase B).
      </div>
    </div>
  );
}
