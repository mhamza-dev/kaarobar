"use client";

import { use } from "react";

import { ConfirmEmail } from "@/features/auth/ConfirmEmail";

/**
 * The link in the confirmation email (`KaarobarWeb.ClientLinks` builds
 * `/confirm-email/<token>`). Outside both route groups: it works whether or
 * not the reader is signed in, on whichever device they opened the email.
 */
export default function ConfirmEmailPage({ params }: PageProps<"/confirm-email/[token]">) {
  const { token } = use(params);

  return <ConfirmEmail token={token} />;
}
