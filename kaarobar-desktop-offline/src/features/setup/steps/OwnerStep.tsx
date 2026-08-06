import { Form, Formik } from 'formik'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '../../../components/ui'
import { FormTextField } from '../../../components/form'
import { ownerSchema, type OwnerFormValues } from '../../../schemas/setupSchemas'

type Props = {
  initial: OwnerFormValues
  loading: boolean
  onBack: () => void
  onNext: (values: OwnerFormValues) => void
}

export function OwnerStep({ initial, loading, onBack, onNext }: Props) {
  const { t } = useTranslation()

  return (
    <Card title={t('setup.ownerTitle')} description={t('setup.ownerDesc')} accent="brand">
      <Formik<OwnerFormValues> initialValues={initial} validationSchema={ownerSchema} onSubmit={onNext}>
        {() => (
          <Form className="space-y-4">
            <FormTextField name="name" label={t('setup.fullName')} />
            <FormTextField name="email" label={t('auth.email')} type="email" />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormTextField name="password" label={t('setup.masterPassword')} type="password" />
              <FormTextField name="confirmPassword" label={t('setup.confirmPassword')} type="password" />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-white/30 pt-4 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start px-0 text-ink-muted hover:bg-transparent hover:text-ink hover:underline sm:w-auto"
                onClick={onBack}
                disabled={loading}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {t('common.back')}
              </Button>
              <Button type="submit" loading={loading} className="w-full sm:ms-auto sm:w-auto sm:min-w-[10rem]">
                {t('common.continue')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Card>
  )
}
