import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import GuestOnly from "@/components/auth/GuestOnly";
import LoginForm from "@/components/auth/LoginForm";
import { routes } from "@/lib/navigation";

export default function LoginPage() {
  return (
    <GuestOnly>
      <AuthShell
        badge="Welcome back"
        title="Sign in to Kaarobar"
        subtitle="Open your owner dashboard across businesses and branches."
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
    </GuestOnly>
  );
}
