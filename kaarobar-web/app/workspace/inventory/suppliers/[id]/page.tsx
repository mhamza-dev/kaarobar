"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";

type Supplier = {
  id: string;
  name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_role?: string | null;
  city?: string | null;
  payment_terms?: string | null;
  catalogs?: string | null;
};

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Supplier }>(`/suppliers/${id}`);
      setSupplier(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load supplier");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DetailShell
      backHref={routes.inventory}
      backLabel="Back to inventory"
      eyebrow="Supplier"
      title={supplier?.name || "Supplier"}
      subtitle={supplier?.city || undefined}
      loading={loading}
      error={error}
    >
      {supplier ? (
        <DetailSection title="Contact">
          <DetailFieldGrid
            fields={[
              { label: "Contact", value: supplier.contact_name || "—" },
              { label: "Role", value: supplier.contact_role || "—" },
              { label: "Phone", value: supplier.contact_phone || "—" },
              { label: "Email", value: supplier.contact_email || "—" },
              { label: "City", value: supplier.city || "—" },
              { label: "Payment terms", value: supplier.payment_terms || "—" },
              { label: "Catalogs", value: supplier.catalogs || "—" },
            ]}
          />
        </DetailSection>
      ) : null}
    </DetailShell>
  );
}
