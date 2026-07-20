import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";
import { routes } from "@/lib/navigation";

export default function LoginPage() {
  return (
    <AuthShell
      badge="Welcome back"
      title="Sign in to Kaarobar"
      subtitle="Access your dashboard, reports, and team workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={routes.signup} variant="link">
            Create one
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
