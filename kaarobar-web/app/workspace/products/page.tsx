"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BuyerProductGridSkeleton } from "@/components/buyer/BuyerSkeletons";

/** `/app/products` — alias redirect to Discover (product-first home). */
export default function ProductsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app");
  }, [router]);

  return <BuyerProductGridSkeleton count={4} />;
}
