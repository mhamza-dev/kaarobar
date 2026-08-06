import { Formik, Form } from 'formik'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_OPTIONS } from '../../../../shared/languages'
import { Button, Card } from '../../../components/ui'
import { FormSelectField } from '../../../components/form'
import { languageSchema, type LanguageFormValues } from '../../../schemas/setupSchemas'

type Props = {
  initial: LanguageFormValues
  loading: boolean
  error?: string
  onBack: () => void
  onFinish: (values: LanguageFormValues) => void
}

export function LanguageStep({ initial, loading, error, onBack, onFinish }: Props) {
  const { t } = useTranslation()

  return (
    <Card title={t('setup.languageTitle')} description={t('setup.languageDesc')} accent="brand">
      <Formik<LanguageFormValues>
        initialValues={initial}
        validationSchema={languageSchema}
        onSubmit={(values) => onFinish(values)}
      >
        {() => (
          <Form className="space-y-4">
            <FormSelectField
              name="language"
              label={t('setup.defaultLanguage')}
              options={LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
            {error ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            ) : null}
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
                {t('setup.finish')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Card>
  )
}
