"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isConsumerSession } from "@/lib/api/client";
import BuyerAccount from "@/components/buyer/BuyerAccount";
import { BuyerLoyaltySkeleton } from "@/components/buyer/BuyerSkeletons";

export default function BuyerAccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConsumerSession()) {
      router.replace("/app");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <BuyerLoyaltySkeleton />;
  return <BuyerAccount />;
}
