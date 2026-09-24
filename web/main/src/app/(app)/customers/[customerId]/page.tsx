"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { CustomerDetail } from "@/features/customers/CustomerDetail";

export default function CustomerDetailPage({ params }: PageProps<"/customers/[customerId]">) {
  const { customerId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Customer"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/customers" />}>
            <ArrowLeft className="size-4" />
            All customers
          </Button>
        }
      />
      <CustomerDetail customerId={customerId} />
    </>
  );
}
