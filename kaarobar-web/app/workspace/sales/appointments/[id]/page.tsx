"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isConsumerSession } from "@/lib/api/client";
import BuyerAppointmentDetail from "@/components/buyer/BuyerAppointmentDetail";
import { BuyerOrderDetailSkeleton } from "@/components/buyer/BuyerSkeletons";

export default function BuyerAppointmentDetailPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isConsumerSession()) {
      router.replace("/app/sales");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <BuyerOrderDetailSkeleton />;
  return <BuyerAppointmentDetail />;
}
