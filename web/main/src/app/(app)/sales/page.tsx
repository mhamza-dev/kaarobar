"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaleReturnsTable } from "@/features/sales/SaleReturnsTable";
import { SalesTable } from "@/features/sales/SalesTable";

export default function SalesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sell"
        title="Sales"
        description="Every completed sale, for lookup, void and refund."
      />
      <Tabs defaultValue="sales">
        <TabsList variant="line">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="pt-4">
          <SalesTable />
        </TabsContent>
        <TabsContent value="returns" className="pt-4">
          <SaleReturnsTable />
        </TabsContent>
      </Tabs>
    </>
  );
}
