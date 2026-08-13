import { useField } from "formik";
import { Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";

import type { CustomerForm } from "@core/lib/customers";
import { useTheme } from "@/theme";


const CUSTOMER_FORM_FIELDS: readonly { key: keyof CustomerForm; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company_name", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "cnic", label: "CNIC" },
  { key: "ntn", label: "NTN" },
  { key: "address", label: "Address" },
  { key: "credit_limit", label: "Credit limit" },
  { key: "user_id", label: "Linked user ID" },
  { key: "notes", label: "Notes" },
];

type CustomerFormFieldsProps = {
  inputStyle: StyleProp<TextStyle>;
};

function FormikTextInput({
  name,
  label,
  inputStyle,
}: {
  name: keyof CustomerForm;
  label: string;
  inputStyle: StyleProp<TextStyle>;
}) {
  const [field, meta, helpers] = useField(name);
  const theme = useTheme();
  return (
    <View>
      <TextInput
        style={inputStyle}
        placeholder={label}
        placeholderTextColor={theme.muted}
        value={String(field.value ?? "")}
        onChangeText={(value) => void helpers.setValue(value)}
        onBlur={() => void helpers.setTouched(true)}
      />
      {meta.touched && meta.error ? (
        <Text style={{ color: theme.danger, fontSize: 12, marginBottom: 6 }}>
          {meta.error}
        </Text>
      ) : null}
    </View>
  );
}

export default function CustomerFormFields({ inputStyle }: CustomerFormFieldsProps) {
  return (
    <>
      {CUSTOMER_FORM_FIELDS.map(({ key, label }) => (
        <FormikTextInput
          key={key}
          name={key}
          label={label}
          inputStyle={inputStyle}
        />
      ))}
    </>
  );
}
