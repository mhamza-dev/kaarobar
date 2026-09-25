"use client";

import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <div className="flex flex-col gap-4">
      {can("valuation:view") && <ValuationStrip />}

      <Tabs defaultValue="levels">
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

  if (isLoading) return <Skeleton className="h-16 w-full max-w-md" />;
  if (!data) return null;

  return (
    <div className="grid max-w-md grid-cols-2 gap-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Stock value, at cost</p>
        <p className="text-lg font-semibold tabular-nums">{formatMoney(data.value, currency)}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Units on hand</p>
        <p className="text-lg font-semibold tabular-nums">{formatQuantity(data.quantity)}</p>
      </div>
    </div>
  );
}
