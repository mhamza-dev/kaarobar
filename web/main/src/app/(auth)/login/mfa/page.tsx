import { Suspense } from "react";

import { AuthShell } from "@/components/shared/AuthShell";
import { MfaChallengeForm } from "@/features/auth/MfaChallengeForm";

export default function LoginMfaPage() {
  return (
    <AuthShell
      title="Two-factor verification"
      description="Enter the code from your authenticator app."
    >
      <Suspense>
        <MfaChallengeForm />
      </Suspense>
    </AuthShell>
  );
}
