"use client";

import {
  Formik,
  Form,
  FormikConfig,
  FormikHelpers,
  FormikProps,
  FormikValues,
} from "formik";

interface FormProps<T extends FormikValues> extends Omit<
  FormikConfig<T>,
  "initialValues" | "onSubmit" | "children"
> {
  initialValues: T;
  onSubmit: (values: T, helpers: FormikHelpers<T>) => void | Promise<void>;
  children: (formik: FormikProps<T>) => React.ReactNode;
  className?: string;
  /** Passed to the underlying HTML form (for footer submit buttons). */
  id?: string;
  /** Defaults to true so edit forms refresh when the entity changes. */
  enableReinitialize?: boolean;
}

const CustomForm = <T extends FormikValues>({
  initialValues,
  onSubmit,
  children,
  className,
  id,
  enableReinitialize = true,
  ...props
}: FormProps<T>) => {
  return (
    <Formik<T>
      initialValues={initialValues}
      onSubmit={onSubmit}
      enableReinitialize={enableReinitialize}
      {...props}
    >
      {(formik) => (
        <Form id={id} className={className}>
          {children(formik)}
        </Form>
      )}
    </Formik>
  );
};

export default CustomForm;
