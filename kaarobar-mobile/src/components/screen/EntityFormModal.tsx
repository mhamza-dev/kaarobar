import { useRef, type ReactNode } from "react";
import type { FormikConfig, FormikHelpers, FormikProps, FormikValues } from "formik";
import { FormModal } from "../FormModal";
import CustomForm from "../ui/CustomForm";

type BaseProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  submitLabel?: string;
  busy?: boolean;
  onClose: () => void;
};

type ClassicProps = BaseProps & {
  onSubmit: () => void;
  children: ReactNode;
};

type FormikModeProps<T extends FormikValues> = BaseProps & {
  initialValues: T;
  validationSchema?: FormikConfig<T>["validationSchema"];
  onSubmit: (values: T, helpers: FormikHelpers<T>) => void | Promise<void>;
  children: (formik: FormikProps<T>) => ReactNode;
  enableReinitialize?: boolean;
};

function isFormikMode<T extends FormikValues>(
  props: ClassicProps | FormikModeProps<T>
): props is FormikModeProps<T> {
  return (
    typeof (props as FormikModeProps<T>).children === "function" &&
    "initialValues" in props &&
    props.initialValues != null
  );
}

/** Entity create/edit sheet. Prefer Formik mode (`initialValues` + render-prop children). */
export default function EntityFormModal<T extends FormikValues>(
  props: ClassicProps | FormikModeProps<T>
) {
  if (isFormikMode(props)) {
    return <EntityFormModalFormik {...props} />;
  }

  const classic = props as ClassicProps;
  return (
    <FormModal
      visible={classic.visible}
      title={classic.title}
      subtitle={classic.subtitle}
      submitLabel={classic.submitLabel}
      busy={classic.busy}
      onClose={classic.onClose}
      onSubmit={classic.onSubmit}
    >
      {classic.children}
    </FormModal>
  );
}

function EntityFormModalFormik<T extends FormikValues>({
  visible,
  title,
  subtitle,
  submitLabel,
  busy,
  onClose,
  initialValues,
  validationSchema,
  onSubmit,
  children,
  enableReinitialize = true,
}: FormikModeProps<T>) {
  const submitRef = useRef<(() => void) | null>(null);

  return (
    <FormModal
      visible={visible}
      title={title}
      subtitle={subtitle}
      submitLabel={submitLabel}
      busy={busy}
      onClose={onClose}
      onSubmit={() => submitRef.current?.()}
    >
      <CustomForm<T>
        initialValues={initialValues}
        validationSchema={validationSchema}
        enableReinitialize={enableReinitialize}
        onSubmit={onSubmit}
      >
        {(formik) => {
          submitRef.current = () => formik.handleSubmit();
          return <>{children(formik)}</>;
        }}
      </CustomForm>
    </FormModal>
  );
}
