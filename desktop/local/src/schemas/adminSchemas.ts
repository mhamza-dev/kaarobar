import * as yup from 'yup'
import { allowedCurrencyCodes } from '../../shared/currencies'

export const businessCreateSchema = yup.object({
  name: yup.string().trim().required('Business name is required'),
  currency: yup
    .string()
    .trim()
    .oneOf([...allowedCurrencyCodes()], 'Select a valid currency')
    .required('Currency is required'),
  brandColor: yup.string().trim().matches(/^#[0-9A-Fa-f]{6}$/, 'Valid hex color is required').required(),
})

/** Same as businessCreateSchema, but keeps a legacy saved currency selectable/valid. */
export function businessSettingsCurrencySchema(currentCurrency?: string | null) {
  return yup.object({
    currency: yup
      .string()
      .trim()
      .oneOf(allowedCurrencyCodes(currentCurrency), 'Select a valid currency')
      .required('Currency is required'),
  })
}

export const branchCreateSchema = yup.object({
  name: yup.string().trim().required('Branch name is required'),
  address: yup.string().trim().default(''),
  phone: yup.string().trim().default(''),
})

export const staffCreateSchema = yup.object({
  name: yup.string().trim().required('Name is required'),
  email: yup.string().trim().email('Enter a valid email').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  role: yup.mixed<'admin' | 'manager' | 'cashier'>().oneOf(['admin', 'manager', 'cashier']).required(),
  branchId: yup.string().nullable().default(null),
})

export const productCreateSchema = yup.object({
  name: yup.string().trim().required('Product name is required'),
  barcode: yup.string().trim().default(''),
  price: yup
    .number()
    .typeError('Enter a valid sale price')
    .min(0, 'Sale price must be >= 0')
    .required('Sale price is required'),
  costPrice: yup
    .number()
    .typeError('Enter a valid cost price')
    .min(0, 'Cost price must be >= 0')
    .nullable()
    .default(null),
  stockQty: yup
    .number()
    .typeError('Enter a valid stock qty')
    .min(0, 'Stock qty must be >= 0')
    .required('Stock qty is required'),
  kind: yup
    .mixed<'item' | 'service' | 'package' | 'deal'>()
    .oneOf(['item', 'service', 'package', 'deal'])
    .required(),
  tracksStock: yup.boolean().required(),
}).test('price-gte-cost', 'Sale price must be greater than or equal to cost price', function (values) {
  const { price, costPrice } = values
  if (costPrice == null || costPrice === ('' as unknown as null)) return true
  if (!Number.isFinite(Number(price)) || !Number.isFinite(Number(costPrice))) return true
  return Number(price) >= Number(costPrice)
})

export const supplierCreateSchema = yup.object({
  name: yup.string().trim().required('Supplier name is required'),
  phone: yup.string().trim().default(''),
  address: yup.string().trim().default(''),
  notes: yup.string().trim().default(''),
})

export const supplierLinkSchema = yup.object({
  productId: yup.string().required('Product is required'),
  unitCost: yup
    .number()
    .typeError('Enter a valid unit cost')
    .min(0, 'Unit cost must be >= 0')
    .required('Unit cost is required'),
})

export const poLineSchema = yup.object({
  productId: yup.string().required(),
  orderedQty: yup
    .number()
    .typeError('Enter a valid quantity')
    .moreThan(0, 'Quantity must be greater than 0')
    .required('Quantity is required'),
  unitCost: yup
    .number()
    .typeError('Enter a valid unit cost')
    .min(0, 'Unit cost must be >= 0')
    .required('Unit cost is required'),
})

export const poCreateSchema = yup.object({
  branchId: yup.string().required('Branch is required'),
  supplierId: yup.string().required('Supplier is required'),
  poNumber: yup.string().trim().required('PO number is required'),
  orderDate: yup.string().trim().required('Order date is required'),
  items: yup
    .array()
    .of(poLineSchema)
    .min(1, 'Add at least one product line')
    .required('Add at least one product line'),
})
