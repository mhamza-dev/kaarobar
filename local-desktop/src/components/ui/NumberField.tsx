import { forwardRef } from 'react'
import { TextField, type TextFieldProps } from './TextField'

export type NumberFieldProps = Omit<TextFieldProps, 'type' | 'inputMode'> & {
  allowDecimal?: boolean
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ allowDecimal = true, onKeyDown, ...props }, ref) => (
    <TextField
      ref={ref}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      onKeyDown={(event) => {
        const allowed = allowDecimal
          ? /[0-9.]|Backspace|Delete|ArrowLeft|ArrowRight|Tab|Home|End/
          : /[0-9]|Backspace|Delete|ArrowLeft|ArrowRight|Tab|Home|End/
        if (!allowed.test(event.key) && !event.metaKey && !event.ctrlKey) {
          event.preventDefault()
        }
        onKeyDown?.(event)
      }}
      {...props}
    />
  ),
)

NumberField.displayName = 'NumberField'
