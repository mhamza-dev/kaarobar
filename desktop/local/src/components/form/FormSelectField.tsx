import { useField } from 'formik'
import { SelectField, type SelectFieldProps } from '../ui/SelectField'

export type FormSelectFieldProps = Omit<
  SelectFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error'
> & {
  name: string
}

export function FormSelectField({ name, ...props }: FormSelectFieldProps) {
  const [field, meta, helpers] = useField<string>(name)
  return (
    <SelectField
      {...props}
      name={name}
      value={field.value ?? ''}
      onChange={(value) => {
        void helpers.setValue(value)
      }}
      onBlur={() => {
        void helpers.setTouched(true)
      }}
      error={meta.touched && meta.error ? meta.error : undefined}
    />
  )
}
