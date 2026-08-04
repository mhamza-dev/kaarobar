import { TextInput, type StyleProp, type TextStyle } from "react-native";
import { colors } from "../../../lib/api";
import type { CustomerForm } from "../../../lib/customers";

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
  form: CustomerForm;
  inputStyle: StyleProp<TextStyle>;
  onChange: (next: CustomerForm) => void;
};

export default function CustomerFormFields({
  form,
  inputStyle,
  onChange,
}: CustomerFormFieldsProps) {
  return (
    <>
      {CUSTOMER_FORM_FIELDS.map(({ key, label }) => (
        <TextInput
          key={key}
          style={inputStyle}
          placeholder={label}
          placeholderTextColor={colors.muted}
          value={String(form[key] ?? "")}
          onChangeText={(value) => onChange({ ...form, [key]: value })}
        />
      ))}
    </>
  );
}
