"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCategoriesList, useDeleteCategory } from "@/hooks/queries/useCategories";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { Category } from "@/types/api/catalog";

import { CategoryDialog } from "./CategoryDialog";

/**
 * The second, deliberately low-risk instance of the list pattern — proof it
 * generalizes without a new table implementation.
 *
 * Depth is rendered as indentation rather than a real tree widget: the
 * backend already returns `depth` and `ancestor_ids`, and a flat, indented
 * list stays sortable and searchable in a way a collapsible tree does not.
 */
export function CategoriesTable() {
  const { data, isLoading, error, refetch } = useCategoriesList();
  const deleteCategory = useDeleteCategory();
  const { can } = usePermission();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const manage = can("category:manage");

  const columns: DataTableColumn<Category>[] = [
    {
      key: "name",
      header: "Category",
      render: (category) => (
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: `${category.depth * 16}px` }}
        >
          <span className="font-medium">{category.name}</span>
          {!category.is_active && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (category) => category.description ?? "—",
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-32",
      render: (category) =>
        manage ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(category);
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(category)}>
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      {manage && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New category
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(category) => category.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (category) => category.name }}
        mobileCardTitle={(category) => category.name}
        mobileCardSubtitle={(category) => category.description ?? ""}
      />

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        categories={data ?? []}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name}?`}
        description="Products in this category keep existing, but lose their category."
        confirmLabel="Delete category"
        destructive
        loading={deleteCategory.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteCategory.mutateAsync([pendingDelete.id]);
            toast.success("Category deleted");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}
