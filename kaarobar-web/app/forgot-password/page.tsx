import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import { routes } from "@/lib/navigation";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      badge="Account recovery"
      title="Reset password"
      subtitle="Enter your email and we'll send reset instructions when the mailer is configured."
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
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2"
            placeholder="you@company.com"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--brand)] px-4 py-3 font-semibold text-white"
        >
          Send reset link
        </button>
      </form>
    </AuthShell>
  );
}
