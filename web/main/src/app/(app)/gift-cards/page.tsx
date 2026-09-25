"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { GiftCardsScreen } from "@/features/customers/GiftCardsScreen";

export default function GiftCardsPage() {
  return (
    <RequireModule module="gift_cards">
      <PageHeader
        eyebrow="Customers"
        title="Gift cards"
        description="Balances, top-ups and new cards. Cards are spent at the till."
      />
      <GiftCardsScreen />
    </RequireModule>
  );
}
