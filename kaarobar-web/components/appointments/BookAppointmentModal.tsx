"use client";

import { useEffect, useState } from "react";
import FormModal from "@/components/app/FormModal";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikDateTimeField,
  FormikSelectField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { formStackClass } from "@/components/app/ui";
import { useT } from "@/lib/i18n";
import {
  emptyStaffBookAppointment,
  staffBookAppointmentSchema,
  type StaffBookAppointmentValues,
} from "@/lib/validations/appointments";
import { couponDateToApi } from "@/lib/validations/marketing";

type Option = { id: string; name: string };

type Props = {
  isOpen: boolean;
  busy?: boolean;
  services: Option[];
  staff: Option[];
  customers: Option[];
  resources: Option[];
  onClose: () => void;
  onSubmit: (values: StaffBookAppointmentValues) => Promise<void> | void;
};

/** Staff book appointment modal (SCH-FR-001 / FUT-FR-081). */
export default function BookAppointmentModal({
  isOpen,
  busy,
  services,
  staff,
  customers,
  resources,
  onClose,
  onSubmit,
}: Props) {
  const t = useT();
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (isOpen) setKey((k) => k + 1);
  }, [isOpen]);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("appointments.bookTitle")}
      description={t("appointments.bookDesc")}
      formId="staff-book-appointment-form"
      submitLabel={t("appointments.confirmBook")}
      cancelLabel={t("common.cancel")}
      submitLoading={busy}
    >
      <CustomForm<StaffBookAppointmentValues>
        key={key}
        id="staff-book-appointment-form"
        className={formStackClass}
        initialValues={emptyStaffBookAppointment()}
        validationSchema={staffBookAppointmentSchema}
        enableReinitialize
        onSubmit={(values) => {
          const startsIso =
            couponDateToApi(values.starts_at) || values.starts_at;
          void onSubmit({ ...values, starts_at: startsIso });
        }}
      >
        {() => (
          <div className={formStackClass}>
            <FormikSelectField
              name="product_id"
              label={t("appointments.service")}
              options={[
                { value: "", label: t("appointments.selectOption") },
                ...services.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <FormikSelectField
              name="staff_id"
              label={t("appointments.staff")}
              options={[
                { value: "", label: t("appointments.selectOption") },
                ...staff.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <FormikSelectField
              name="customer_id"
              label={t("appointments.customer")}
              options={[
                { value: "", label: t("appointments.walkIn") },
                ...customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <FormikDateTimeField
              name="starts_at"
              label={t("appointments.startTime")}
              mode="datetime"
            />
            {resources.length > 0 ? (
              <FormikSelectField
                name="bookable_resource_id"
                label={t("appointments.resource")}
                options={[
                  { value: "", label: t("appointments.autoAssignResource") },
                  ...resources.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            ) : null}
            <FormikTextField
              name="notes"
              label={t("appointments.notes")}
              type="textarea"
              rows={2}
              placeholder={t("appointments.notesPlaceholder")}
            />
          </div>
        )}
      </CustomForm>
    </FormModal>
  );
}
