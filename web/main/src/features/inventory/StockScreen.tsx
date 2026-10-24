"use client";

import { Boxes, Coins } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { StatCard } from "@/components/shared/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStockValuation } from "@/hooks/queries/useInventory";
import { usePermission } from "@/hooks/usePermission";
import { useSheetParam } from "@/hooks/useSheetParam";
import { formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";

import { ReorderTable } from "./ReorderTable";
import { StockItemSheet } from "./StockItemSheet";
import { StockTable } from "./StockTable";

/** Stock levels, what needs reordering, and — for those allowed — what it's all worth. */
export function StockScreen() {
  const { can } = usePermission();
  const sheet = useSheetParam();
  // `?tab=reorder` opens straight onto what's running low — the dashboard
  // links here.
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-col gap-4">
      {can("valuation:view") && <ValuationStrip />}

      <Tabs defaultValue={searchParams.get("tab") === "reorder" ? "reorder" : "levels"}>
        <TabsList variant="line">
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="reorder">To reorder</TabsTrigger>
        </TabsList>
        <TabsContent value="levels" className="pt-4">
          <StockTable onOpen={sheet.open} />
        </TabsContent>
        <TabsContent value="reorder" className="pt-4">
          <ReorderTable onOpen={sheet.open} />
        </TabsContent>
      </Tabs>

      <StockItemSheet sheetKey={sheet.value} onClose={sheet.close} />
    </div>
  );
}

function ValuationStrip() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading } = useStockValuation();

  if (!isLoading && !data) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
      <StatCard
        label="Stock value, at cost"
        icon={Coins}
        loading={isLoading}
        value={formatMoney(data?.value, currency)}
        hint="Across every branch"
      />
      <StatCard
        label="Units on hand"
        icon={Boxes}
        loading={isLoading}
        value={formatQuantity(data?.quantity)}
        hint="Counted, not yet sold"
      />
    </div>
  );
}
