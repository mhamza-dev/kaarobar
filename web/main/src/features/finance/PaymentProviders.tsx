"use client";

import { Form, Formik } from "formik";
import { Copy, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateProvider,
  useDeleteProvider,
  usePaymentProviders,
  useUpdateProvider,
} from "@/hooks/queries/useFinance";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { env } from "@/lib/env";
import {
  credentialsToSend,
  PROVIDER_CREDENTIALS,
  PROVIDER_LABELS,
  webhookUrlFor,
} from "@/lib/paymentProviders";
import {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  type PaymentProviderKey,
} from "@/types/api/payments";

/**
 * Payment gateways — JazzCash, Easypaisa, Stripe, or manual.
 *
 * Secrets go in and never come out: the list shows only whether each
 * provider has credentials and a webhook secret set (`configured`,
 * `webhook_configured`), and the edit form starts blank — leaving it blank
 * keeps what is stored.
 */
export function PaymentProviders() {
  const { can } = usePermission();
  const canConfigure = can("payment:configure");
  const { data, isLoading, error, refetch } = usePaymentProviders();
  const remove = useDeleteProvider();
  const [editing, setEditing] = useState<PaymentProvider | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PaymentProvider | null>(null);

  const columns: DataTableColumn<PaymentProvider>[] = [
    {
      key: "name",
      header: "Provider",
      render: (provider) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{provider.display_name}</p>
            <p className="text-xs text-muted-foreground">
              {PROVIDER_LABELS[provider.provider as PaymentProviderKey] ?? provider.provider}
            </p>
          </div>
          {provider.is_default && <Badge variant="secondary">Default</Badge>}
          {!provider.is_active && <Badge variant="outline">Off</Badge>}
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (provider) => (
        <Badge variant={provider.mode === "live" ? "default" : "outline"}>
          {provider.mode === "live" ? "Live" : "Test"}
        </Badge>
      ),
    },
    {
      key: "setup",
      header: "Set up",
      render: (provider) => {
        const needsKeys = PROVIDER_CREDENTIALS[provider.provider as PaymentProviderKey]?.length;
        return (
          <div className="flex flex-wrap gap-1 text-xs">
            {needsKeys ? (
              <Badge variant={provider.configured ? "secondary" : "destructive"}>
                {provider.configured ? "Keys set" : "Keys missing"}
              </Badge>
            ) : null}
            {provider.provider !== "manual" && (
              <Badge variant={provider.webhook_configured ? "secondary" : "outline"}>
                {provider.webhook_configured ? "Webhook set" : "No webhook secret"}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-32",
      render: (provider) =>
        canConfigure ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(provider);
                setOpen(true);
              }}
            >
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(provider)}>
              Remove
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      {canConfigure && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add provider
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(provider) => provider.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        mobileCardTitle={(provider) => provider.display_name}
        mobileCardSubtitle={(provider) => provider.provider}
      />
      <ProviderDialog open={open} onOpenChange={setOpen} provider={editing} />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.display_name}?`}
        description="Past payments keep their history. The till can no longer charge through it."
        confirmLabel="Remove provider"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await remove.mutateAsync([pendingDelete.id]);
            toast.success("Provider removed");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

function ProviderDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: PaymentProvider | null;
}) {
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const editing = !!provider;

  const blankCredentials = Object.fromEntries(
    Object.values(PROVIDER_CREDENTIALS)
      .flat()
      .map((field) => [field.key, ""]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${provider?.display_name}` : "Add payment provider"}
          </DialogTitle>
          {editing && (
            <DialogDescription>
              Keys are never shown again once saved. Leave them blank to keep the stored ones.
            </DialogDescription>
          )}
        </DialogHeader>
        <Formik
          initialValues={{
            provider: provider?.provider ?? "jazzcash",
            display_name: provider?.display_name ?? "",
            mode: provider?.mode ?? "test",
            credentials: blankCredentials as Record<string, string>,
            webhook_secret: "",
            is_active: provider?.is_active ?? true,
            is_default: provider?.is_default ?? false,
          }}
          enableReinitialize
          validationSchema={Yup.object({
            display_name: Yup.string().trim().required("Name it as the cashier will see it"),
          })}
          onSubmit={async (values, helpers) => {
            const credentials = credentialsToSend(values.provider, values.credentials);
            const needsKeys =
              PROVIDER_CREDENTIALS[values.provider as PaymentProviderKey].length > 0;
            if (!editing && needsKeys && !credentials) {
              helpers.setFieldError(
                `credentials.${PROVIDER_CREDENTIALS[values.provider as PaymentProviderKey][0].key}`,
                "The gateway's keys are required",
              );
              return;
            }

            const payload = {
              ...(editing ? {} : { provider: values.provider }),
              display_name: values.display_name.trim(),
              mode: values.mode,
              is_active: values.is_active,
              is_default: values.is_default,
              ...(credentials ? { credentials } : {}),
              ...(values.webhook_secret.trim()
                ? { webhook_secret: values.webhook_secret.trim() }
                : {}),
            };

            try {
              if (editing) await update.mutateAsync([provider!.id, payload]);
              else await create.mutateAsync([payload]);
              toast.success(editing ? "Provider updated" : "Provider added");
              onOpenChange(false);
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
          {({ isSubmitting, values }) => {
            const fields = PROVIDER_CREDENTIALS[values.provider as PaymentProviderKey] ?? [];
            const webhook = webhookUrlFor(env.apiUrl, values.provider);

            return (
              <Form className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormSelectField
                    name="provider"
                    label="Gateway"
                    disabled={editing}
                    options={PAYMENT_PROVIDERS.map((key) => ({
                      value: key,
                      label: PROVIDER_LABELS[key],
                    }))}
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
                <FormTextField
                  name="display_name"
                  label="Name at the till"
                  placeholder="JazzCash wallet"
                  autoFocus
                />

                {fields.length > 0 && (
                  <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
                    <legend className="px-1 text-sm font-medium">Keys</legend>
                    {fields.map((field) => (
                      <FormTextField
                        key={field.key}
                        name={`credentials.${field.key}`}
                        label={field.label}
                        type={field.secret ? "password" : "text"}
                        placeholder={editing ? "Unchanged" : undefined}
                        autoComplete="off"
                      />
                    ))}
                  </fieldset>
                )}

                {values.provider !== "manual" && (
                  <div className="flex flex-col gap-2">
                    <FormTextField
                      name="webhook_secret"
                      label="Webhook secret"
                      type="password"
                      placeholder={editing ? "Unchanged" : undefined}
                      autoComplete="off"
                    />
                    <div className="flex items-center gap-2 rounded-lg bg-muted p-2 text-xs">
                      <span className="text-muted-foreground">Webhook URL</span>
                      <code className="min-w-0 flex-1 truncate">{webhook}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Copy webhook URL"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(webhook)
                            .then(() => toast.success("Copied"))
                            .catch(() => toast.error("Couldn't copy"))
                        }
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>
                )}

                <FormSwitch name="is_active" label="Take payments through this provider" />
                <FormSwitch
                  name="is_default"
                  label="Default provider"
                  hint="Offered first at the till."
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    {editing ? "Save" : "Add provider"}
                  </Button>
                </DialogFooter>
              </Form>
            );
          }}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
