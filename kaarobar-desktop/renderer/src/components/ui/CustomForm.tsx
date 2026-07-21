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
}

const CustomForm = <T extends FormikValues>({
  initialValues,
  onSubmit,
  children,
  className,
  ...props
}: FormProps<T>) => {
  return (
    <Formik<T> initialValues={initialValues} onSubmit={onSubmit} {...props}>
      {(formik) => <Form className={className}>{children(formik)}</Form>}
    </Formik>
  );
};

export default CustomForm;
