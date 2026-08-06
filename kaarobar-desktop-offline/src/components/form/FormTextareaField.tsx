import { useField } from 'formik'
import { TextareaField, type TextareaFieldProps } from '../ui/TextareaField'

export type FormTextareaFieldProps = Omit<
  TextareaFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error'
> & {
  name: string
}

export function FormTextareaField({ name, ...props }: FormTextareaFieldProps) {
  const [field, meta] = useField<string>(name)
  return (
    <TextareaField
      {...props}
      {...field}
      error={meta.touched && meta.error ? meta.error : undefined}
    />
  )
}
