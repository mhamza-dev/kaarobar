import { useField } from 'formik'
import { TextField, type TextFieldProps } from '../ui/TextField'

export type FormTextFieldProps = Omit<TextFieldProps, 'name' | 'value' | 'onChange' | 'onBlur' | 'error'> & {
  name: string
}

export function FormTextField({ name, ...props }: FormTextFieldProps) {
  const [field, meta] = useField<string>(name)
  return (
    <TextField
      {...props}
      {...field}
      error={meta.touched && meta.error ? meta.error : undefined}
    />
  )
}
