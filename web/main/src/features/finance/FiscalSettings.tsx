"use client";

import { Form, Formik } from "formik";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFiscalConfig,
  useFiscalStatus,
  useFiscalSubmissions,
  useRetryAllSubmissions,
  useRetrySubmission,
  useSaveFiscalConfig,
} from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDateTime, humanize } from "@/lib/format";
import { type FiscalConfigPayload, type FiscalSubmission } from "@/types/api/fiscal";

/**
 * The tax-authority connection (FBR's POS integration, or a generic
 * endpoint) and the log of what it said about each sale.
 *
 * The status banner is the part that matters day to day: with blocking on,
 * a backlog of unstamped sales stops the till opening — `selling_blocked`
 * is computed server-side so this screen, the till and the dashboard can't
 * disagree about it.
 */
export function FiscalSettings() {
  const { can } = usePermission();
  const { data: status } = useFiscalStatus();

  return (
    <div className="flex flex-col gap-6">
      {status && (
        <div
          className={
            status.selling_blocked
              ? "flex items-start gap-3 rounded-xl border border-destructive bg-danger-soft p-4 text-sm"
              : "flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm"
          }
        >
          {status.selling_blocked && <AlertTriangle className="size-5 text-destructive" />}
          <div>
            <p className="font-medium">
              {status.selling_blocked
                ? "Selling is blocked until the backlog is cleared"
                : status.reporting
                  ? `Reporting to ${status.adapter?.toUpperCase()} (${status.mode ?? "test"} mode)`
                  : "Not reporting to a tax authority"}
            </p>
            <p className="text-muted-foreground">
              {status.backlog === 0
                ? "Every sale has been reported."
                : `${status.backlog} sale${status.backlog === 1 ? "" : "s"} waiting to be reported.`}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue={can("fiscal:configure") ? "connection" : "submissions"}>
        <TabsList variant="line">
          {can("fiscal:configure") && <TabsTrigger value="connection">Connection</TabsTrigger>}
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>
        {can("fiscal:configure") && (
          <TabsContent value="connection" className="pt-4">
            <ConnectionForm />
          </TabsContent>
        )}
        <TabsContent value="submissions" className="pt-4">
          <SubmissionsTable canRetry={can("fiscal:retry")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionForm() {
  const { data: config, isLoading } = useFiscalConfig();
  const save = useSaveFiscalConfig();

  if (isLoading) return <Skeleton className="h-64 w-full max-w-2xl" />;

  return (
    <Formik
      initialValues={{
        adapter: config?.adapter ?? "none",
        mode: config?.mode ?? "test",
        taxpayer_number: config?.taxpayer_number ?? "",
        pos_id: config?.pos_id ?? "",
        endpoint_url: config?.endpoint_url ?? "",
        token: "",
        is_active: config?.is_active ?? false,
        block_on_failure: config?.block_on_failure ?? false,
      }}
      enableReinitialize
      validationSchema={Yup.object({
        // `Fiscal.Config` refuses to switch reporting on without these.
        taxpayer_number: Yup.string().when(["is_active", "adapter"], {
          is: (active: boolean, adapter: string) => active && adapter !== "none",
          then: (rule) => rule.trim().required("Needed before reporting can start"),
        }),
        pos_id: Yup.string().when(["is_active", "adapter"], {
          is: (active: boolean, adapter: string) => active && adapter !== "none",
          then: (rule) => rule.trim().required("Needed before reporting can start"),
        }),
        endpoint_url: Yup.string().url("Enter a full URL"),
      })}
      onSubmit={async (values, helpers) => {
        const payload: FiscalConfigPayload = {
          adapter: values.adapter,
          mode: values.mode,
          taxpayer_number: values.taxpayer_number || null,
          pos_id: values.pos_id || null,
          endpoint_url: values.endpoint_url || null,
          is_active: values.is_active,
          block_on_failure: values.block_on_failure,
          // Write-only: blank keeps the stored token.
          ...(values.token.trim() ? { credentials: { token: values.token.trim() } } : {}),
        };
        try {
          await save.mutateAsync([payload]);
          toast.success("Fiscal settings saved");
          helpers.setFieldValue("token", "");
        } catch (error) {
          const { unmapped } = applyApiFieldErrors({
            error,
            values,
            setErrors: helpers.setErrors,
          });
          for (const message of unmapped) toast.error(message);
        }
      }}
    >
      {({ isSubmitting, values }) => (
        <Form className="flex max-w-2xl flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelectField
              name="adapter"
              label="Authority"
              options={[
                { value: "none", label: "None" },
                { value: "fbr", label: "FBR (Pakistan POS integration)" },
                { value: "generic", label: "Other (generic endpoint)" },
              ]}
            />
            <FormSelectField
              name="mode"
              label="Mode"
              options={[
                { value: "test", label: "Test (sandbox)" },
                { value: "live", label: "Live" },
              ]}
            />
          </div>
          {values.adapter !== "none" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="taxpayer_number" label="NTN / taxpayer number" />
                <FormTextField name="pos_id" label="POS ID" />
              </div>
              {values.adapter === "generic" && (
                <FormTextField name="endpoint_url" label="Endpoint URL" type="url" />
              )}
              <FormTextField
                name="token"
                label="Access token"
                type="password"
                autoComplete="off"
                placeholder={config?.has_credentials ? "Stored — leave blank to keep" : undefined}
              />
              <FormSwitch
                name="is_active"
                label="Report every sale"
                hint="Each completed sale is sent for a fiscal number."
              />
              <FormSwitch
                name="block_on_failure"
                label="Stop selling when reporting fails"
                hint="The till won't open while sales are waiting to be reported."
              />
            </>
          )}
          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

function SubmissionsTable({ canRetry }: { canRetry: boolean }) {
  const [attentionOnly, setAttentionOnly] = useState(false);
  const { data, isLoading, error, refetch } = useFiscalSubmissions({
    needs_attention: attentionOnly || undefined,
  });
  const retry = useRetrySubmission();
  const retryAll = useRetryAllSubmissions();

  const columns: DataTableColumn<FiscalSubmission>[] = [
    { key: "when", header: "When", render: (row) => formatDateTime(row.inserted_at) },
    { key: "kind", header: "Kind", render: (row) => humanize(row.kind) },
    {
      key: "number",
      header: "Fiscal number",
      render: (row) => row.fiscal_number ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div>
          <StatusBadge status={row.status} />
          {row.last_error && (
            <p className="mt-1 max-w-xs text-xs text-destructive">
              {row.error_code && <code>{row.error_code}: </code>}
              {row.last_error}
            </p>
          )}
        </div>
      ),
    },
    { key: "attempts", header: "Tries", align: "end", render: (row) => row.attempts },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-24",
      render: (row) =>
        canRetry && row.needs_attention ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={retry.isPending}
            onClick={async () => {
              try {
                await retry.mutateAsync([row.id]);
                toast.success("Queued to retry");
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            Retry
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(event) => setAttentionOnly(event.target.checked)}
          />
          Only those needing attention
        </label>
        {canRetry && (
          <Button
            variant="outline"
            disabled={retryAll.isPending}
            onClick={async () => {
              try {
                await retryAll.mutateAsync([]);
                toast.success("Backlog queued to retry");
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            <RotateCcw className="size-4" />
            Retry all
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing reported yet.</p>
        }
        mobileCardTitle={(row) => row.fiscal_number ?? humanize(row.kind)}
        mobileCardSubtitle={(row) => humanize(row.status)}
      />
    </>
  );
}
