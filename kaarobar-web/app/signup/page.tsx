import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import GuestOnly from "@/components/auth/GuestOnly";
import SignupForm from "@/components/auth/SignupForm";
import { routes } from "@/lib/navigation";

export default function SignupPage() {
  return (
    <GuestOnly>
      <AuthShell
        badge="Start free trial"
        title="Create your owner account"
        subtitle="Provision a business, default Pakistan COA, and your first branch."
        footer={
          <>
            Already have an account?{" "}
            <Link href={routes.login} variant="link">
              Sign in
            </Link>
          </>
        }
      >
        <SignupForm />
      </AuthShell>
    </GuestOnly>
  );
}
