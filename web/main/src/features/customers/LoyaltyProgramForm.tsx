"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoyaltyProgram, useSaveLoyaltyProgram } from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { fractionToPercent, percentToFraction } from "@/lib/format";
import type { LoyaltyProgram } from "@/types/api/crm";

const optionalNumber = () =>
  Yup.number().transform((value, original) => (original === "" ? undefined : value));

const schema = Yup.object({
  name: Yup.string().trim().required("Give the programme a name"),
  earn_rate: optionalNumber().required("Required").min(0, "Can't be negative"),
  redeem_rate: optionalNumber().required("Required").min(0, "Can't be negative"),
  min_points_to_redeem: optionalNumber().integer().min(0, "Can't be negative"),
  max_redeem_percent: optionalNumber()
    .moreThan(0, "Must be more than 0%")
    .max(100, "Can't be more than 100%"),
  points_expire_after_days: optionalNumber().integer().moreThan(0, "Must be at least a day"),
});

/**
 * The points scheme's rules — an owner's decision (`loyalty:manage`),
 * because the earn rate changes what every future sale costs the shop.
 *
 * The form leads with the one number the two rates hide: the scheme's cost
 * as a share of takings, `earn_rate × redeem_rate` (see
 * `Kaarobar.Loyalty.Program`). Showing it live is the cheapest way to stop
 * somebody configuring a 10% giveaway by accident.
 */
export function LoyaltyProgramForm() {
  const { can } = usePermission();
  const program = useLoyaltyProgram();
  const notFound = program.error instanceof ApiError && program.error.status === 404;
  const exists = !!program.data;
  const save = useSaveLoyaltyProgram(exists);
  const canManage = can("loyalty:manage");

  if (program.isLoading) return <Skeleton className="h-64 w-full max-w-2xl" />;

  if (program.error && !notFound) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load the programme.</p>;
  }

  const current: Partial<LoyaltyProgram> = program.data ?? {};

  return (
    <Formik
      initialValues={{
        name: current.name ?? "Rewards",
        points_label: current.points_label ?? "points",
        earn_rate: current.earn_rate ?? "1",
        redeem_rate: current.redeem_rate ?? "0.01",
        min_points_to_redeem: current.min_points_to_redeem?.toString() ?? "0",
        max_redeem_percent: fractionToPercent(current.max_redeem_percent ?? null),
        points_expire_after_days: current.points_expire_after_days?.toString() ?? "",
        earn_on_discounted: current.earn_on_discounted ?? true,
        earn_on_tax: current.earn_on_tax ?? false,
        is_active: current.is_active ?? true,
      }}
      enableReinitialize
      validationSchema={schema}
      onSubmit={async (values, helpers) => {
        try {
          await save.mutateAsync([
            {
              name: values.name,
              points_label: values.points_label || "points",
              earn_rate: String(values.earn_rate),
              redeem_rate: String(values.redeem_rate),
              min_points_to_redeem:
                values.min_points_to_redeem === "" ? 0 : Number(values.min_points_to_redeem),
              max_redeem_percent: percentToFraction(values.max_redeem_percent),
              points_expire_after_days:
                values.points_expire_after_days === ""
                  ? null
                  : Number(values.points_expire_after_days),
              earn_on_discounted: values.earn_on_discounted,
              earn_on_tax: values.earn_on_tax,
              is_active: values.is_active,
            },
          ]);
          toast.success(exists ? "Programme updated" : "Programme started");
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
        const cost = Number(values.earn_rate) * Number(values.redeem_rate) * 100;

        return (
          <Form className="flex max-w-2xl flex-col gap-4">
            {!exists && (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                No programme is running yet. Saving this starts one.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormTextField name="name" label="Programme name" disabled={!canManage} />
              <FormTextField
                name="points_label"
                label="What points are called"
                placeholder="points, stars, coins…"
                disabled={!canManage}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormNumberField
                name="earn_rate"
                label="Earned per unit spent"
                min={0}
                step={0.1}
                hint="1 earns one point per rupee."
                disabled={!canManage}
              />
              <FormNumberField
                name="redeem_rate"
                label="One point is worth"
                min={0}
                step={0.001}
                hint="0.01 makes 100 points worth one rupee."
                disabled={!canManage}
              />
            </div>

            <p className="text-sm">
              Costs the shop{" "}
              <span className="font-semibold tabular-nums">
                {Number.isFinite(cost) ? `${Number(cost.toFixed(2))}%` : "—"}
              </span>{" "}
              of takings when every point is redeemed.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormNumberField
                name="min_points_to_redeem"
                label="Minimum to redeem"
                min={0}
                step={1}
                disabled={!canManage}
              />
              <FormNumberField
                name="max_redeem_percent"
                label="Max share of a bill"
                suffix="%"
                min={0}
                max={100}
                hint="Blank for no cap."
                disabled={!canManage}
              />
              <FormNumberField
                name="points_expire_after_days"
                label="Points expire after"
                suffix="days"
                min={1}
                hint="Blank never expires."
                disabled={!canManage}
              />
            </div>

            <FormSwitch
              name="earn_on_discounted"
              label="Earn on discounted items"
              disabled={!canManage}
            />
            <FormSwitch name="earn_on_tax" label="Earn on the tax portion" disabled={!canManage} />
            <FormSwitch
              name="is_active"
              label="Programme running"
              hint="Off stops earning and redeeming; balances are kept."
              disabled={!canManage}
            />

            {canManage && (
              <div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {exists ? "Save programme" : "Start programme"}
                </Button>
              </div>
            )}
          </Form>
        );
      }}
    </Formik>
  );
}
