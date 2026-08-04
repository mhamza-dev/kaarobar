import { useField } from "formik";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "../../lib/api";

type Props = {
  name: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps["style"];
} & Omit<TextInputProps, "value" | "onChangeText" | "onBlur">;

/** Formik-bound text field for RN consumer forms. */
export function FormikTextField({
  name,
  label,
  style,
  inputStyle,
  ...inputProps
}: Props) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        value={field.value ?? ""}
        onChangeText={(text) => void helpers.setValue(text)}
        onBlur={() => void helpers.setTouched(true)}
        placeholderTextColor={inputProps.placeholderTextColor ?? colors.muted}
        style={[styles.input, inputStyle]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.heading,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: colors.radiusLg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
    color: colors.heading,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 8,
  },
});