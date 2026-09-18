"use client";

import { Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOpenShift } from "@/hooks/queries/useRegisters";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { Register } from "@/types/api/sales";

/**
 * What the till shows before the drawer is open.
 *
 * A sale needs a shift to belong to — that is what makes the day's takings
 * reconcilable — so this is a gate rather than a suggestion.
 */
export function OpenShiftPrompt({ register }: { register: Register }) {
  const [float, setFloat] = useState("");
  const openShift = useOpenShift();
  const { can } = usePermission();

  if (!can("shift:open")) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <LockKeyhole className="size-8 text-muted-foreground" />
        <div>
          <p className="font-medium">No shift is open on {register.name}</p>
          <p className="text-sm text-muted-foreground">
            Ask a supervisor to open the drawer before selling.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-16">
      <div className="text-center">
        <p className="font-medium">Open {register.name}</p>
        <p className="text-sm text-muted-foreground">
          Count the float in the drawer and enter it — the close will be measured against it.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="opening-float">Opening float</Label>
        <Input
          id="opening-float"
          inputMode="decimal"
          value={float}
          autoFocus
          placeholder="0.00"
          onChange={(event) => setFloat(event.target.value)}
        />
      </div>

      <Button
        disabled={openShift.isPending || float === ""}
        onClick={async () => {
          try {
            await openShift.mutateAsync([register.id, { opening_float: float }]);
            toast.success("Shift opened");
          } catch {
            // Toasted by the hook.
          }
        }}
      >
        {openShift.isPending && <Loader2 className="size-4 animate-spin" />}
        Open shift
      </Button>
    </div>
  );
}
