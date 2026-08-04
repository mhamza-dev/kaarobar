import { useField, useFormikContext } from "formik";
import {
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors } from "../../lib/api";
import Switch from "./Switch";
import DateTimePicker, { type DateTimePickerMode } from "./DateTimePicker";
import { SearchSelect, SearchMultiSelect } from "../SearchSelect";

type FieldBase = {
  name: string;
  label?: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export function FormikTextField({
  name,
  label,
  placeholder,
  style,
  containerStyle,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  editable = true,
}: FieldBase & {
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  editable?: boolean;
}) {
  const [field, meta, helpers] = useField(name);
  const showError = meta.touched && meta.error;
  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: colors.heading,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        style={style}
        placeholder={placeholder || label}
        placeholderTextColor={colors.muted}
        value={String(field.value ?? "")}
        onChangeText={(v) => void helpers.setValue(v)}
        onBlur={() => void helpers.setTouched(true)}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        editable={editable}
      />
      {showError ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 6 }}>
          {meta.error}
        </Text>
      ) : null}
    </View>
  );
}

export function FormikSwitchField({
  name,
  label,
  description,
  containerStyle,
}: FieldBase & { description?: string }) {
  const [field, meta, helpers] = useField({ name, type: "checkbox" });
  const showError = meta.touched && meta.error;
  return (
    <View style={[{ marginBottom: 10 }, containerStyle]}>
      <Switch
        checked={Boolean(field.value)}
        onChange={(next) => void helpers.setValue(next)}
        label={label}
        description={description}
      />
      {showError ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>
          {meta.error}
        </Text>
      ) : null}
    </View>
  );
}

export function FormikDateTimeField({
  name,
  label,
  mode = "date",
  placeholder,
  containerStyle,
}: FieldBase & {
  mode?: DateTimePickerMode;
  placeholder?: string;
}) {
  const [field, meta, helpers] = useField(name);
  const { setFieldTouched } = useFormikContext();
  const showError = meta.touched && meta.error;
  return (
    <View style={[{ marginBottom: 10 }, containerStyle]}>
      <DateTimePicker
        label={label}
        mode={mode}
        value={String(field.value ?? "")}
        onChange={(v) => {
          void helpers.setValue(v);
          void setFieldTouched(name, true, false);
        }}
        placeholder={placeholder}
      />
      {showError ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>
          {meta.error}
        </Text>
      ) : null}
    </View>
  );
}

export function FormikSearchSelectField({
  name,
  label,
  options,
  placeholder,
  disabled,
  onValueChange,
}: FieldBase & {
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string | null) => void;
}) {
  const [field, meta, helpers] = useField(name);
  const showError = meta.touched && meta.error;
  return (
    <View style={{ marginBottom: 8 }}>
      <SearchSelect
        label={label}
        options={options}
        value={field.value || null}
        onChange={(v) => {
          void helpers.setValue(v || "");
          void helpers.setTouched(true);
          onValueChange?.(v);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {showError ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 6 }}>
          {meta.error}
        </Text>
      ) : null}
    </View>
  );
}

export function FormikSearchMultiSelectField({
  name,
  label,
  options,
  placeholder,
  disabled,
  onValueChange,
}: FieldBase & {
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (value: string[]) => void;
}) {
  const [field, meta, helpers] = useField(name);
  const showError = meta.touched && meta.error;
  return (
    <View style={{ marginBottom: 8 }}>
      <SearchMultiSelect
        label={label}
        options={options}
        value={Array.isArray(field.value) ? field.value : []}
        onChange={(v) => {
          void helpers.setValue(v);
          void helpers.setTouched(true);
          onValueChange?.(v);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {showError ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 6 }}>
          {meta.error}
        </Text>
      ) : null}
    </View>
  );
}

/** Form-level / nested field error helper. */
export function FormikErrorText({ name }: { name: string }) {
  const [, meta] = useField(name);
  if (!(meta.touched && meta.error)) return null;
  return (
    <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 6 }}>
      {typeof meta.error === "string" ? meta.error : "Invalid"}
    </Text>
  );
}
