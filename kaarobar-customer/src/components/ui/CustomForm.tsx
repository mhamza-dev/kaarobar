import {
  Formik,
  FormikConfig,
  FormikHelpers,
  FormikProps,
  FormikValues,
} from "formik";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type Props<T extends FormikValues> = Omit<
  FormikConfig<T>,
  "initialValues" | "onSubmit" | "children"
> & {
  initialValues: T;
  onSubmit: (values: T, helpers: FormikHelpers<T>) => void | Promise<void>;
  children: (formik: FormikProps<T>) => ReactNode;
  style?: StyleProp<ViewStyle>;
  enableReinitialize?: boolean;
};

/** React Native Formik wrapper (no DOM <form>). */
export default function CustomForm<T extends FormikValues>({
  initialValues,
  onSubmit,
  children,
  style,
  enableReinitialize = true,
  ...props
}: Props<T>) {
  return (
    <Formik<T>
      initialValues={initialValues}
      onSubmit={onSubmit}
      enableReinitialize={enableReinitialize}
      {...props}
    >
      {(formik) => <View style={style}>{children(formik)}</View>}
    </Formik>
  );
}
