import { AuthShell } from "@/components/shared/AuthShell";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const tokenValue = Array.isArray(token) ? token[0] : token;

  return (
    <AuthShell title="Set a new password">
      {tokenValue ? (
        <ResetPasswordForm token={tokenValue} />
      ) : (
        <p className="text-sm text-muted-foreground">
          This reset link is missing its token. Request a new one from the sign-in page.
        </p>
      )}
    </AuthShell>
  );
}
