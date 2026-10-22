"use client";

import { use } from "react";

import { AcceptInvitationForm } from "@/features/auth/AcceptInvitationForm";

/**
 * The link in the invitation email (`KaarobarWeb.ClientLinks` builds
 * `/invitations/<token>`). Same flow as `/invite/[token]`; both are outside
 * the `(app)` and `(auth)` groups because the invitee has no session yet, and
 * `proxy.ts` lets both through.
 */
export default function InvitationPage({ params }: PageProps<"/invitations/[token]">) {
  const { token } = use(params);

  return <AcceptInvitationForm token={token} />;
}
