"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useSetStaffBranches } from "@/hooks/queries/useStaff";
import { toast } from "@/hooks/useToast";
import type { StaffMember } from "@/types/api/staffing";

/**
 * `PUT /staff/:id/branches`.
 *
 * The backend treats an empty list as *every* branch rather than none
 * (`Staffing.assign_branches/3`), which is easy to misread as "no access".
 * The dialog therefore says so in words and offers "All branches" as an
 * explicit choice, so nobody clears the boxes expecting to lock someone out.
 */
export function StaffBranchesDialog({
  staff,
  onOpenChange,
}: {
  staff: StaffMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!staff} onOpenChange={onOpenChange}>
      {staff && (
        // Keyed remount seeds the checkboxes from this person's branches —
        // see StaffRolesDialog for why this isn't an effect.
        <StaffBranchesDialogBody key={staff.id} staff={staff} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  );
}

function StaffBranchesDialogBody({
  staff,
  onOpenChange,
}: {
  staff: StaffMember;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: branches, isLoading } = useBranchesList();
  const setBranches = useSetStaffBranches();
  const [selected, setSelected] = useState<string[]>(() => staff.branch_ids);

  const allBranches = selected.length === 0;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Branches for {staff.user?.name ?? staff.user?.email}</DialogTitle>
        <DialogDescription>
          Pick the branches this person works at. Selecting none means they can work at every
          branch.
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2 rounded-lg border border-border p-2">
          <Checkbox id="branch-all" checked={allBranches} onCheckedChange={() => setSelected([])} />
          <Label htmlFor="branch-all" className="font-normal">
            All branches
          </Label>
        </div>

        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-8" />)
          : branches?.map((branch) => (
              <div key={branch.id} className="flex items-center gap-2">
                <Checkbox
                  id={`branch-${branch.id}`}
                  checked={selected.includes(branch.id)}
                  onCheckedChange={() =>
                    setSelected((ids) =>
                      ids.includes(branch.id)
                        ? ids.filter((id) => id !== branch.id)
                        : [...ids, branch.id],
                    )
                  }
                />
                <Label htmlFor={`branch-${branch.id}`} className="font-normal">
                  {branch.name}
                </Label>
              </div>
            ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          disabled={setBranches.isPending}
          onClick={async () => {
            try {
              await setBranches.mutateAsync([staff.id, selected]);
              toast.success("Branches updated");
              onOpenChange(false);
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          {setBranches.isPending && <Loader2 className="size-4 animate-spin" />}
          Save branches
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
