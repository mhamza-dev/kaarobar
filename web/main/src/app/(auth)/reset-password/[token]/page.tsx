import { AuthShell } from "@/components/shared/AuthShell";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

/**
 * The link in the password-reset email. The backend puts the token in the
 * path rather than the query string (`KaarobarWeb.ClientLinks`) — paths stay
 * out of `Referer` headers and fewer proxy logs, and until it's used the
 * token is as good as a password. `/reset-password?token=` still works too.
 */
export default async function ResetPasswordTokenPage({
  params,
}: PageProps<"/reset-password/[token]">) {
  const { token } = await params;

  return (
    <AuthShell title="Set a new password">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
