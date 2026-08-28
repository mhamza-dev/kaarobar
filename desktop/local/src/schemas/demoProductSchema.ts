import * as Yup from 'yup'

/** Phase 1 demo schema — proves Formik + Yup wiring with shared form fields. */
export const demoProductSchema = Yup.object({
  name: Yup.string().trim().required('Product name is required').min(2, 'At least 2 characters'),
  barcode: Yup.string().trim().optional(),
  price: Yup.number()
    .typeError('Enter a valid price')
    .required('Price is required')
    .min(0, 'Price cannot be negative'),
  category: Yup.string().required('Select a category'),
  notes: Yup.string().max(240, 'Keep notes under 240 characters'),
  trackStock: Yup.boolean().required(),
  isActive: Yup.boolean().required(),
})

export type DemoProductValues = Yup.InferType<typeof demoProductSchema>
