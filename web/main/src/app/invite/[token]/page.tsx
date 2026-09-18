"use client";

import { use } from "react";

import { AcceptInvitationForm } from "@/features/auth/AcceptInvitationForm";

/**
 * The invitee's entry point — deliberately outside both the `(app)` and
 * `(auth)` groups: the person opening this link has no session yet, and
 * `proxy.ts` must let it through unauthenticated.
 */
export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = use(params);

  return <AcceptInvitationForm token={token} />;
}
