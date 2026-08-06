import { useState } from 'react'
import { Form, Formik } from 'formik'
import * as yup from 'yup'
import { useTranslation } from 'react-i18next'
import { Card, Button, Modal } from '../../components/ui'
import { FormTextField } from '../../components/form'
import { AuthShell, LanguageSelect } from '../../components/layout'

type LoginFormValues = {
  email: string
  password: string
}

type Props = {
  loading: boolean
  error?: string
  onSubmit: (values: LoginFormValues) => void
}

export function LoginScreen({ loading, error, onSubmit }: Props) {
  const { t } = useTranslation()
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotError, setForgotError] = useState<string | undefined>()
  const [forgotSuccess, setForgotSuccess] = useState<string | undefined>()

  const loginSchema = yup.object({
    email: yup
      .string()
      .trim()
      .email(t('auth.emailInvalid'))
      .required(t('auth.emailRequired')),
    password: yup.string().required(t('auth.passwordRequired')),
  })
  const forgotSchema = yup.object({
    email: yup.string().trim().email(t('auth.emailInvalid')).required(t('auth.emailRequired')),
    licenseKey: yup.string().trim().required(t('license.licenseKeyRequired')),
    newPassword: yup.string().min(8, t('auth.passwordMin')).required(t('auth.passwordRequired')),
    confirmPassword: yup
      .string()
      .required(t('setup.confirmPassword'))
      .oneOf([yup.ref('newPassword')], t('auth.passwordsMustMatch')),
  })

  return (
    <AuthShell
      width="md"
      brandAlign="center"
      tagline={t('auth.brandTagline')}
      headerActions={<LanguageSelect containerClassName="w-40" />}
    >
      <Card title={t('auth.title')} description={t('auth.description')} accent="brand">
        <Formik<LoginFormValues>
          initialValues={{ email: '', password: '' }}
          validationSchema={loginSchema}
          onSubmit={onSubmit}
        >
          {() => (
            <Form className="space-y-4">
              <FormTextField name="email" label={t('auth.email')} type="email" autoFocus />
              <FormTextField name="password" label={t('auth.password')} type="password" />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-0 text-sm text-ink-muted hover:bg-transparent hover:text-brand-primary hover:underline"
                  onClick={() => {
                    setForgotError(undefined)
                    setForgotSuccess(undefined)
                    setForgotOpen(true)
                  }}
                >
                  {t('auth.forgotPassword')}
                </Button>
              </div>
              {error ? (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" loading={loading} className="w-full">
                {t('auth.submit')}
              </Button>
            </Form>
          )}
        </Formik>
      </Card>

      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title={t('auth.resetPasswordTitle')}>
        <Formik
          initialValues={{ email: '', licenseKey: '', newPassword: '', confirmPassword: '' }}
          validationSchema={forgotSchema}
          onSubmit={async (values, helpers) => {
            setForgotError(undefined)
            setForgotSuccess(undefined)
            const result = await window.api.auth.resetOwnerPasswordOffline({
              email: values.email.trim(),
              licenseKey: values.licenseKey.trim(),
              newPassword: values.newPassword,
            })
            if (!result.ok) {
              setForgotError(result.message)
              return
            }
            setForgotSuccess(t('auth.resetPasswordSuccess'))
            helpers.resetForm()
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-3">
              <p className="text-sm text-ink-muted">{t('auth.resetPasswordHint')}</p>
              <FormTextField name="email" label={t('auth.email')} type="email" />
              <FormTextField name="licenseKey" label={t('license.licenseKey')} placeholder="XXXX-XXXX-XXXX" />
              <FormTextField name="newPassword" label={t('auth.newPassword')} type="password" />
              <FormTextField name="confirmPassword" label={t('setup.confirmPassword')} type="password" />
              {forgotError ? (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">
                  {forgotError}
                </p>
              ) : null}
              {forgotSuccess ? (
                <p className="rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success" role="status">
                  {forgotSuccess}
                </p>
              ) : null}
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => setForgotOpen(false)}>
                  {t('common.close')}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {t('auth.resetPasswordAction')}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>
    </AuthShell>
  )
}
