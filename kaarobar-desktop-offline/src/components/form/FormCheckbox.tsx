import { useField } from 'formik'
import { Checkbox, type CheckboxProps } from '../ui/Checkbox'

export type FormCheckboxProps = Omit<
  CheckboxProps,
  'name' | 'checked' | 'onChange' | 'onBlur' | 'error'
> & {
  name: string
}

export function FormCheckbox({ name, ...props }: FormCheckboxProps) {
  const [field, meta] = useField({ name, type: 'checkbox' })
  return (
    <Checkbox
      {...props}
      name={field.name}
      checked={Boolean(field.checked)}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={meta.touched && meta.error ? meta.error : undefined}
    />
  )
}
