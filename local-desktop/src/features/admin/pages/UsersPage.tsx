import { useState } from 'react'
import { Form, Formik } from 'formik'
import { Plus, Power } from 'lucide-react'
import * as yup from 'yup'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Table,
  useToast } from '../../../components/ui'
import { FormSelectField, FormTextField } from '../../../components/form'
import { PageHeader } from '../../../components/layout'
import { staffCreateSchema } from '../../../schemas/adminSchemas'
import { useActionVisibility } from '../../../lib/nav'
import { hasLicenseFeature, useLicenseFeatures, useLicenseLimits } from '../../../lib/license'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { useAuthStore } from '../../../stores/authStore'
import { assetSrc } from '../../../lib/assets'
import type { SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
}

export function UsersPage({ user, data }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const setUser = useAuthStore((state) => state.setUser)
  const actions = useActionVisibility(user)
  const licenseFeatures = useLicenseFeatures()
  const { maxUsers } = useLicenseLimits()
  const [open, setOpen] = useState(false)
  const { staff, branchOptions, activeBusinessId, refreshScopedData } = data
  const activeStaffCount = staff.filter((member) => member.isActive).length
  const seatLimitReached = Number.isFinite(maxUsers) && activeStaffCount >= maxUsers
  const ownerSettingsSchema = yup.object({
    name: yup.string().trim().required('Name is required'),
    currentPassword: yup.string().trim().default(''),
    newPassword: yup.string().trim().default(''),
    confirmPassword: yup
      .string()
      .trim()
      .when('newPassword', {
        is: (val: string) => Boolean(val),
        then: (schema) => schema.required('Please confirm password').oneOf([yup.ref('newPassword')], 'Passwords must match'),
        otherwise: (schema) => schema.default('') }) })

  if (!actions.canManageUsers) return null
  if (!hasLicenseFeature(licenseFeatures, 'staff')) return null

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowStaff')}
        title={t('dashboard.users')}
        description={t('dashboard.usersDesc')}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button onClick={() => setOpen(true)} disabled={seatLimitReached}>
              <Plus className="size-4" />
              {t('forms.addUser')}
            </Button>
            {Number.isFinite(maxUsers) ? (
              <p className="text-xs text-ink-muted">
                {t('license.seatUsage', { used: activeStaffCount, max: maxUsers })}
              </p>
            ) : null}
          </div>
        }
      />

      {user.role === 'owner' ? (
        <Card title={t('forms.ownerSettings')} className="mb-6">
          <Formik
            enableReinitialize
            initialValues={{
              name: user.name,
              imagePath: user.imagePath,
              currentPassword: '',
              newPassword: '',
              confirmPassword: '' }}
            validationSchema={ownerSettingsSchema}
            onSubmit={async (values, helpers) => {
              try {
                const updated = await window.api.users.updateSelf({
                  name: values.name,
                  imagePath: values.imagePath,
                  currentPassword: values.currentPassword || undefined,
                  newPassword: values.newPassword || undefined })
                setUser(updated)
                toast.success(t('toast.profileUpdated'))
                helpers.setFieldValue('currentPassword', '')
                helpers.setFieldValue('newPassword', '')
                helpers.setFieldValue('confirmPassword', '')
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            }}
          >
            {({ values, setFieldValue, isSubmitting }) => (
              <Form className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-ink">{t('forms.profileImage')}</p>
                    {values.imagePath ? (
                      <img
                        src={assetSrc(values.imagePath) ?? undefined}
                        alt=""
                        className="size-24 rounded-lg border border-line object-cover bg-surface-muted"
                      />
                    ) : (
                      <div className="grid size-24 place-items-center rounded-lg border border-dashed border-line bg-surface-muted text-sm text-ink-subtle">
                        —
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={async () => {
                          const picked = await window.api.assets.pickAndSave({ kind: 'product' })
                          if (picked) setFieldValue('imagePath', picked.relativePath)
                        }}
                      >
                        {t('forms.chooseImage')}
                      </Button>
                      {values.imagePath ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setFieldValue('imagePath', null)}
                        >
                          {t('forms.removeImage')}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FormTextField name="name" label={t('forms.name')} />
                    <p className="text-xs text-ink-muted">{t('forms.passwordChangeHint')}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormTextField name="currentPassword" label={t('forms.currentPassword')} type="password" />
                      <FormTextField name="newPassword" label={t('forms.newPassword')} type="password" />
                      <FormTextField name="confirmPassword" label={t('setup.confirmPassword')} type="password" />
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button type="submit" loading={isSubmitting}>
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Form>
            )}
          </Formik>
        </Card>
      ) : null}

      <Card title={t('dashboard.staffUsers')}>
        {staff.length === 0 ? (
          <EmptyState title={t('empty.noUsers')} description={t('empty.noUsersDesc')} />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.id}
            rows={staff}
            search={{
              getText: (row) => `${row.name} ${row.email}` }}
            filters={[
              {
                id: 'role',
                label: t('forms.role'),
                type: 'select',
                options: [
                  { value: 'admin', label: t('roles.admin') },
                  { value: 'manager', label: t('roles.manager') },
                  { value: 'cashier', label: t('roles.cashier') },
                ],
                getValue: (row) => row.role },
              {
                id: 'active',
                label: t('forms.status'),
                type: 'boolean',
                getValue: (row) => row.isActive },
            ]}
            mobileCardTitle={(row) => row.name}
            mobileCardSubtitle={(row) => row.role}
            mobileCardFields={[
              {
                key: 'status',
                label: t('forms.status'),
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ) },
            ]}
            mobileCardActions={(row) => (
              <RowActionsMenu
                actions={[
                  {
                    id: 'toggle',
                    label: row.isActive ? t('common.deactivate') : t('common.activate'),
                    icon: <Power className="size-4" />,
                    danger: row.isActive,
                    onSelect: async () => {
                      try {
                        await window.api.users.setActive({
                          userId: row.id,
                          isActive: !row.isActive })
                        if (activeBusinessId) await refreshScopedData(activeBusinessId)
                      } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                      }
                    } },
                ]}
              />
            )}
            columns={[
              { key: 'name', header: t('forms.name'), render: (row) => row.name },
              { key: 'role', header: t('forms.role'), width: 'w-28', render: (row) => row.role },
              {
                key: 'status',
                header: t('forms.status'),
                width: 'w-28',
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ) },
                {
                  key: 'actions',
                  header: <span className="sr-only">{t('forms.actions')}</span>,
                  width: 'w-28',
                  align: 'end',
                  render: (row) => (
                    <RowActionsMenu
                      actions={[
                        {
                          id: 'toggle',
                          label: row.isActive ? t('common.deactivate') : t('common.activate'),
                          icon: <Power className="size-4" />,
                          danger: row.isActive,
                          onSelect: async () => {
                            try {
                              await window.api.users.setActive({
                                userId: row.id,
                                isActive: !row.isActive })
                              if (activeBusinessId) await refreshScopedData(activeBusinessId)
                            } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                            }
                          } },
                      ]}
                    />
                  ) },
            ]}
          />
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t('forms.createStaff')}>
        <Formik
          initialValues={{
            name: '',
            email: '',
            password: '',
            role: 'cashier' as 'admin' | 'manager' | 'cashier',
            branchId: null as string | null }}
          validationSchema={staffCreateSchema}
          onSubmit={async (values) => {
            if (!activeBusinessId) return
            try {
              await window.api.users.create({
                businessId: activeBusinessId,
                branchId: values.branchId || null,
                name: values.name,
                email: values.email,
                password: values.password,
                role: values.role })
              toast.success(t('toast.userCreated'))
              await refreshScopedData(activeBusinessId)
              setOpen(false)
            } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-3">
              <FormTextField name="name" label={t('forms.name')} />
              <FormTextField name="email" label={t('forms.email')} />
              <FormTextField name="password" label={t('forms.password')} type="password" />
              <FormSelectField
                name="role"
                label={t('forms.role')}
                options={[
                  ...(user.role === 'owner' ? [{ value: 'admin', label: t('roles.admin') }] : []),
                  { value: 'manager', label: t('roles.manager') },
                  { value: 'cashier', label: t('roles.cashier') },
                ]}
              />
              {branchOptions.length > 1 ? (
                <FormSelectField
                  name="branchId"
                  label={t('forms.branchOptional')}
                  options={[{ value: '', label: t('forms.anyBranch') }, ...branchOptions]}
                  placeholder={t('forms.anyBranch')}
                />
              ) : null}
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {t('common.save')}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>
    </div>
  )
}
