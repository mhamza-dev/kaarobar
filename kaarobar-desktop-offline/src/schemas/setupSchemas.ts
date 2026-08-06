import * as yup from 'yup'
import { CURRENCY_CODES } from '../../shared/currencies'
import { APP_LANGUAGES, type AppLanguage } from '../../shared/languages'

export type LicenseFormValues = {
  licenseKey: string
}

export type OwnerFormValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export type BusinessFormValues = {
  name: string
  currency: string
  brandColor: string
  businessNature: 'retail' | 'food' | 'salon' | 'services'
  branchName: string
  branchAddress: string
  branchPhone: string
}

export type LanguageFormValues = {
  language: AppLanguage
}

export const licenseSchema = yup.object({
  licenseKey: yup.string().trim().min(6).required('License key is required'),
})

export const ownerSchema = yup.object({
  name: yup.string().trim().min(2).required('Owner name is required'),
  email: yup.string().trim().email('Enter a valid email').required('Owner email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: yup
    .string()
    .required('Please confirm password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
})

export const businessSchema = yup.object({
  name: yup.string().trim().required('Business name is required'),
  currency: yup
    .string()
    .trim()
    .oneOf([...CURRENCY_CODES], 'Select a valid currency')
    .required('Currency is required'),
  brandColor: yup.string().trim().matches(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid hex color').required(),
  businessNature: yup
    .mixed<'retail' | 'food' | 'salon' | 'services'>()
    .oneOf(['retail', 'food', 'salon', 'services'])
    .required('Business type is required'),
  branchName: yup.string().trim().required('Branch name is required'),
  branchAddress: yup.string().trim().default(''),
  branchPhone: yup.string().trim().default(''),
})

export const languageSchema = yup.object({
  language: yup.mixed<AppLanguage>().oneOf([...APP_LANGUAGES]).required(),
})
