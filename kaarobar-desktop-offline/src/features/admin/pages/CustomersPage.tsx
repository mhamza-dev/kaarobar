import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Form, Formik } from "formik";
import { useTranslation } from "react-i18next";
import { useFormatMoney } from "../../../lib/useFormatMoney";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  Table,
  useToast,
} from "../../../components/ui";
import { FormTextField } from "../../../components/form";
import { PageHeader } from "../../../components/layout";
import { useActionVisibility } from "../../../lib/nav";
import { RowActionsMenu } from "../components/RowActionsMenu";
import type { Customer, SessionUser } from "../../../../shared/types/api";
import type { AdminData } from "../hooks/useAdminData";
import * as yup from "yup";

type Props = {
  user: SessionUser;
  data: AdminData;
  onOpenCustomer: (customerId: string) => void;
};

export function CustomersPage({ user, data, onOpenCustomer }: Props) {
  const { t } = useTranslation();
  const customerSchema = yup.object({
    name: yup.string().trim().required(),
    phone: yup.string().trim().default(""),
    address: yup.string().trim().default(""),
    amount: yup
      .number()
      .transform((value, originalValue) =>
        originalValue === "" ||
        originalValue === null ||
        originalValue === undefined
          ? 0
          : value,
      )
      .min(0, t("forms.amount"))
      .default(0),
  });
  const formatMoney = useFormatMoney();
  const toast = useToast();
  const actions = useActionVisibility(user);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { customers, activeBusinessId, refreshScopedData } = data;
  const creditOutstanding = customers.reduce(
    (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0),
    0,
  );
  const withBalance = customers.filter((c) => c.currentBalance > 0).length;

  const customerActions = (row: Customer) => [
    ...(actions.canEditCustomers
      ? [
          {
            id: "edit",
            label: t("common.edit"),
            icon: <Pencil className="size-4" />,
            onSelect: () => {
              setEditingCustomer(row);
              setCustomerOpen(true);
            },
          },
        ]
      : []),
  ];

  if (!actions.canEditCustomers) return null;

  return (
    <div>
      <PageHeader
        eyebrow={t("dashboard.eyebrowCustomers")}
        title={t("dashboard.customers")}
        description={t("dashboard.customersDesc")}
        actions={
          <Button
            onClick={() => {
              setEditingCustomer(null);
              setCustomerOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("forms.addCustomer")}
          </Button>
        }
      />

      {customers.length > 0 ? (
        <div className="mb-5 rounded-lg border border-warning/20 bg-gradient-to-br from-warning-soft/40 to-surface-raised px-4 py-3 shadow-soft sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            {t("dashboard.creditOutstandingHint")}
          </p>
          <p className="mt-1 text-xl font-bold text-ink">
            {formatMoney(creditOutstanding)}
          </p>
          <p className="text-sm text-ink-muted">
            {t("dashboard.statWithBalance", { count: withBalance })}
          </p>
        </div>
      ) : null}

      <Card
        title={t("dashboard.customers")}
        description={t("dashboard.customersDesc")}
      >
        {customers.length === 0 ? (
          <EmptyState
            title={t("empty.noCustomers")}
            description={t("empty.noCustomersDesc")}
          />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.id}
            rows={customers}
            onRowClick={(row) => onOpenCustomer(row.id)}
            search={{
              getText: (row) => `${row.name} ${row.phone ?? ""}`,
            }}
            filters={[
              {
                id: "hasBalance",
                label: t("forms.credit"),
                type: "select",
                options: [
                  { value: "due", label: t("table.balanceDue") },
                  { value: "clear", label: t("table.balanceClear") },
                ],
                getValue: (row) => (row.currentBalance > 0 ? "due" : "clear"),
              },
              {
                id: "active",
                label: t("forms.status"),
                type: "boolean",
                getValue: (row) => row.isActive,
              },
            ]}
            mobileCardTitle={(row) => row.name}
            mobileCardSubtitle={(row) => row.phone ?? "—"}
            mobileCardFields={[
              {
                key: "credit",
                label: t("forms.credit"),
                render: (row) => formatMoney(row.currentBalance),
              },
            ]}
            mobileCardActions={(row) => (
              <RowActionsMenu actions={customerActions(row)} />
            )}
            columns={[
              {
                key: "name",
                header: t("forms.name"),
                render: (row) => (
                  <span className="font-medium">{row.name}</span>
                ),
              },
              {
                key: "phone",
                header: t("forms.phone"),
                render: (row) => row.phone ?? "—",
              },
              {
                key: "credit",
                header: t("forms.credit"),
                render: (row) => formatMoney(row.currentBalance),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("forms.actions")}</span>,
                width: "w-28",
                align: "end",
                render: (row) => (
                  <RowActionsMenu actions={customerActions(row)} />
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        title={
          editingCustomer ? t("forms.editCustomer") : t("forms.addCustomer")
        }
      >
        <Formik
          enableReinitialize
          initialValues={{
            name: editingCustomer?.name ?? "",
            phone: editingCustomer?.phone ?? "",
            address: editingCustomer?.address ?? "",
            amount: 0,
          }}
          validationSchema={customerSchema}
          onSubmit={async (values) => {
            if (!activeBusinessId) return;
            try {
              if (editingCustomer) {
                await window.api.customers.update({
                  id: editingCustomer.id,
                  name: values.name,
                  phone: values.phone || null,
                  address: values.address || null,
                });
                toast.success(t("toast.customerUpdated"));
              } else {
                await window.api.customers.create({
                  businessId: activeBusinessId,
                  name: values.name,
                  phone: values.phone || undefined,
                  address: values.address || undefined,
                  amount: Number(values.amount) || 0,
                });
                toast.success(t("toast.customerCreated"));
              }
              await refreshScopedData(activeBusinessId);
              setCustomerOpen(false);
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : t("toast.actionFailed"),
              );
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-3">
              <FormTextField name="name" label={t("forms.name")} />
              <FormTextField name="phone" label={t("forms.phone")} />
              <FormTextField name="address" label={t("forms.address")} />
              {!editingCustomer ? (
                <FormTextField
                  name="amount"
                  label={t("forms.startingKhataAmount")}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                />
              ) : null}
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCustomerOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {t("common.save")}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>
    </div>
  );
}
