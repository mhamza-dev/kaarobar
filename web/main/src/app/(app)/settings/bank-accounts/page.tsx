"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { BankAccountsTable } from "@/features/settings/BankAccountsTable";

export default function BankAccountsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Bank accounts"
        description="Where expenses are paid from, and what's left in each."
      />
      <BankAccountsTable />
    </>
  );
}
