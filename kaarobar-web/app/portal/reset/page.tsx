"use client";

import { useState } from "react";
import Link from "next/link";
import { portalApi } from "@/lib/portal-api";
import Button from "@/components/ui/Button";

export default function PortalResetPage() {
  const [businessId, setBusinessId] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await portalApi(
        "/portal/auth/request-reset",
        {
          method: "POST",
          body: JSON.stringify({ business_id: businessId.trim(), email: email.trim() }),
        },
        null
      );
      setMessage("If that account exists, a reset token was emailed.");
      setStep("reset");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await portalApi(
        "/portal/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({ token: token.trim(), password }),
        },
        null
      );
      setMessage("Password updated. You can sign in.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-heading">Reset password</h1>
      {message ? <p className="mt-4 text-sm text-body">{message}</p> : null}
      {step === "request" ? (
        <form onSubmit={requestReset} className="mt-6 grid gap-3">
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
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Button type="submit" loading={busy}>
            Email reset token
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="mt-6 grid gap-3">
          <label className="text-sm font-medium text-heading">
            Token
            <input
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-heading">
            New password
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
            Update password
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm text-body">
        <Link href="/portal/login" className="text-brand underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
