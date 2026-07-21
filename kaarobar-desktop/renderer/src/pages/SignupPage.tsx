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
        subtitle="We’ll set up your first business, a Pakistan chart of accounts, and a starting branch."
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
