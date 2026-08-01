"use client";

import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import GuestOnly from "@/components/auth/GuestOnly";
import { routes } from "@/lib/navigation";

export default function ForgotPasswordPage() {
  return (
    <GuestOnly>
      <AuthShell
        badge="Account help"
        title="Reset your password"
        subtitle="Enter your email and we will send reset instructions."
        footer={
          <>
            Remembered it?{" "}
            <Link href={routes.login} variant="link">
              Back to sign in
            </Link>
          </>
        }
      >
        <form className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Email</span>
            <input
              type="email"
              required
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
              placeholder="you@company.com"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--brand)] px-4 py-3 font-semibold text-white"
          >
            Send reset link
          </button>
        </form>
      </AuthShell>
    </GuestOnly>
  );
}
