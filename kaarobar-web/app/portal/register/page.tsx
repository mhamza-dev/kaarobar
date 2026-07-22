"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { portalApi, setPortalSession, type PortalSession } from "@/lib/portal-api";
import Button from "@/components/ui/Button";

export default function PortalRegisterPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await portalApi<{
        data: { access_token: string; account: PortalSession["account"] };
      }>(
        "/portal/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            business_id: businessId.trim(),
            name: name.trim(),
            email: email.trim(),
            password,
          }),
        },
        null
      );
      setPortalSession({
        access_token: res.data.access_token,
        business_id: res.data.account.business_id,
        account: res.data.account,
      });
      router.replace("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-heading">Create customer account</h1>
      <p className="mt-2 text-sm text-body">
        Self-register when the business has portal registration enabled.
      </p>
      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 grid gap-3">
        <label className="text-sm font-medium text-heading">
          Business ID
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            required
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-heading">
          Name
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-heading">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-heading">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button type="submit" loading={busy}>
          Register
        </Button>
      </form>
      <p className="mt-4 text-sm text-body">
        Already have an account?{" "}
        <Link href="/portal/login" className="text-brand underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
