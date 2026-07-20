import Link from "@/components/ui/Link";

import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";
import { routes } from "@/lib/navigation";

export default function SignupPage() {
  return (
    <AuthShell
      badge="Start free trial"
      title="Create your account"
      subtitle="Set up your business workspace in a few minutes."
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
  );
}
