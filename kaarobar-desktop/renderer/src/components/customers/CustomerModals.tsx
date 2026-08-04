import Modal from "@/components/modals/Modal";
import FormModalFooter from "@/components/app/FormModalFooter";
import CustomForm from "@/components/ui/CustomForm";
import {
  FormikSwitchField,
  FormikTextField,
} from "@/components/ui/FormFields";
import { formGridClass, formStackClass } from "@/components/app/ui";
import { formatDecimal } from "@/lib/decimal";
import type { Customer, CustomerForm } from "@/lib/customers";
import {
  CUSTOMER_FORM_FIELDS,
  customerToForm,
  emptyCustomerForm,
} from "@/lib/customers";
import {
  customerFormSchema,
  loyaltyAdjustSchema,
} from "@/lib/validations/customers";

type Translate = (key: string, values?: Record<string, string | number>) => string;

type CustomerFormModalProps = {
  isOpen: boolean;
  busy: boolean;
  editing: Customer | null;
  /** Overrides values derived from `editing` when provided. */
  initialValues?: CustomerForm;
  t: Translate;
  onClose: () => void;
  onSubmit: (values: CustomerForm) => void | Promise<void>;
};

export function CustomerFormModal({
  isOpen,
  busy,
  editing,
  initialValues,
  t,
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  const values =
    initialValues ?? (editing ? customerToForm(editing) : emptyCustomerForm());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("customers.edit") : t("customers.add")}
      size="lg"
      footer={
        <FormModalFooter
          cancelLabel={t("common.cancel")}
          submitLabel={editing ? t("common.save") : t("common.create")}
          onCancel={onClose}
          submitFormId="customer-form"
          loading={busy}
        />
      }
    >
      <CustomForm
        id="customer-form"
        className={formStackClass}
        initialValues={values}
        validationSchema={customerFormSchema}
        onSubmit={async (formValues) => {
          const next = { ...formValues };
          if (next.credit_limit.trim()) {
            next.credit_limit = formatDecimal(next.credit_limit);
          }
          await onSubmit(next);
        }}
      >
        {({ values: formValues }) => (
          <div className={formGridClass}>
            {CUSTOMER_FORM_FIELDS.map((f) => {
              if (f.type === "checkbox") {
                return (
                  <FormikSwitchField
                    key={f.key}
                    name={f.key}
                    label={t(f.labelKey)}
                    className="sm:col-span-2"
                  />
                );
              }
              if (f.type === "textarea") {
                return (
                  <FormikTextField
                    key={f.key}
                    name={f.key}
                    label={t(f.labelKey)}
                    type="textarea"
                    rows={3}
                    className="sm:col-span-2"
                    placeholder={f.placeholderKey ? t(f.placeholderKey) : undefined}
                  />
                );
              }
              return (
                <FormikTextField
                  key={f.key}
                  name={f.key}
                  label={t(f.labelKey)}
                  type={f.key === "credit_limit" ? "number" : f.type || "text"}
                  required={
                    f.required ||
                    (f.key === "portal_password" &&
                      formValues.portal_enabled &&
                      !editing?.portal_enabled)
                  }
                  placeholder={
                    f.key === "portal_password" && editing?.portal_enabled
                      ? t("customers.portalPasswordHint")
                      : f.placeholderKey
                        ? t(f.placeholderKey)
                        : undefined
                  }
                  hint={f.hintKey ? t(f.hintKey) : undefined}
                />
              );
            })}
          </div>
        )}
      </CustomForm>
    </Modal>
  );
}

type LoyaltyFormValues = {
  delta: number;
  reason: string;
};

type LoyaltyModalProps = {
  isOpen: boolean;
  busy: boolean;
  customerName: string;
  currentPoints: number;
  t: Translate;
  onClose: () => void;
  onSubmit: (values: LoyaltyFormValues) => void | Promise<void>;
};

export function LoyaltyAdjustmentModal({
  isOpen,
  busy,
  customerName,
  currentPoints,
  t,
  onClose,
  onSubmit,
}: LoyaltyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("customers.adjustPointsTitle", { name: customerName })}
      footer={
        <FormModalFooter
          cancelLabel={t("common.cancel")}
          submitLabel={t("customers.apply")}
          onCancel={onClose}
          submitFormId="loyalty-form"
          loading={busy}
        />
      }
    >
      <CustomForm
        id="loyalty-form"
        className={formStackClass}
        initialValues={{ delta: 10, reason: "" } satisfies LoyaltyFormValues}
        validationSchema={loyaltyAdjustSchema}
        onSubmit={async (values) => {
          await onSubmit({
            delta: Number(values.delta),
            reason: values.reason || "",
          });
        }}
      >
        {() => (
          <div className={formStackClass}>
            <p className="text-sm text-body">
              {t("customers.currentPoints", { count: currentPoints })}
            </p>
            <div className={formGridClass}>
              <FormikTextField
                name="delta"
                label={t("customers.delta")}
                type="number"
                placeholder={t("customers.phDelta")}
              />
              <FormikTextField
                name="reason"
                label={t("customers.reason")}
                placeholder={t("customers.phReason")}
              />
            </div>
          </div>
        )}
      </CustomForm>
    </Modal>
  );
}
