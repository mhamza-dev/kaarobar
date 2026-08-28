import { useField } from 'formik'
import { NumberField, type NumberFieldProps } from '../ui/NumberField'

export type FormNumberFieldProps = Omit<
  NumberFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error'
> & {
  name: string
}

export function FormNumberField({ name, ...props }: FormNumberFieldProps) {
  const [field, meta, helpers] = useField<string | number>(name)
  const displayValue =
    field.value === '' || field.value === undefined || field.value === null
      ? ''
      : String(field.value)

  return (
    <NumberField
      {...props}
      name={field.name}
      value={displayValue}
      onBlur={field.onBlur}
      onChange={(event) => {
        const raw = event.target.value
        if (raw === '' || raw === '.') {
          helpers.setValue('')
          return
        }
        const parsed = Number(raw)
        helpers.setValue(Number.isNaN(parsed) ? raw : parsed)
      }}
      error={meta.touched && meta.error ? meta.error : undefined}
    />
  )
}
