"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { AccountScreen } from "@/features/account/AccountScreen";

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Profile and sign-in"
        description="Your own details, how you sign in, and where you're signed in."
      />
      <AccountScreen />
    </>
  );
}
