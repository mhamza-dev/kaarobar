import { useField } from 'formik'
import { Toggle, type ToggleProps } from '../ui/Toggle'

export type FormToggleProps = Omit<ToggleProps, 'checked' | 'onCheckedChange' | 'name'> & {
  name: string
}

export function FormToggle({ name, ...props }: FormToggleProps) {
  const [field, , helpers] = useField<boolean>(name)
  return (
    <Toggle
      {...props}
      name={name}
      checked={Boolean(field.value)}
      onCheckedChange={(checked) => helpers.setValue(checked)}
    />
  )
}
