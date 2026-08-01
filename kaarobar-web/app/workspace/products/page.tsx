"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isConsumerSession } from "@/lib/api/client";
import BuyerProducts from "@/components/buyer/BuyerProducts";
import { BuyerProductGridSkeleton } from "@/components/buyer/BuyerSkeletons";

export default function ProductsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConsumerSession()) {
      router.replace("/app");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <BuyerProductGridSkeleton count={4} />;
  return <BuyerProducts />;
}
