import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpCircle,
  ArrowUpRight,
  Check,
  Crown,
  KeyRound,
  Minus,
  Printer,
  Truck,
  UsersRound,
  Wallet,
  Zap,
} from 'lucide-react'
import { Badge, Button, Card, Modal, TextField, useToast } from '../../../components/ui'
import { useLicenseStore } from '../../../stores/licenseStore'
import {
  LICENSE_FEATURES,
  LICENSE_PLAN_FEATURES,
  LICENSE_PLAN_LIMITS,
  LICENSE_PLAN_ORDER,
  type LicenseFeature,
  type LicensePlanName,
} from '../../../lib/license'
import { useFormatDate } from '../../../lib/useFormatDate'
import { cn } from '../../../lib/cn'

const FEATURE_LABEL_KEYS: Record<LicenseFeature, string> = {
  pos: 'license.featurePos',
  sales: 'license.featureSales',
  products: 'license.featureProducts',
  customers: 'license.featureCustomers',
  credit: 'license.featureCredit',
  suppliers: 'license.featureSuppliers',
  purchase_orders: 'license.featurePurchaseOrders',
  staff: 'license.featureStaff',
  happy_hour: 'license.featureHappyHour',
}

const PLAN_META: Record<
  LicensePlanName,
  { icon: typeof Zap; labelKey: string; bubble: string }
> = {
  basic: { icon: Zap, labelKey: 'license.planBasic', bubble: 'bg-surface-muted text-ink-muted' },
  standard: { icon: UsersRound, labelKey: 'license.planStandard', bubble: 'bg-brand-tint text-brand-primary' },
  advanced: { icon: Wallet, labelKey: 'license.planAdvanced', bubble: 'bg-warning-soft text-warning' },
  pro: { icon: Truck, labelKey: 'license.planPro', bubble: 'bg-success-soft text-success' },
  full: { icon: Crown, labelKey: 'license.planFull', bubble: 'bg-brand-primary text-brand-on-primary shadow-glow' },
}

/**
 * Plan comparison + the in-app upgrade path: every plan with its limits and
 * features, the installed plan highlighted, and Upgrade buttons that open a
 * centered modal for the new key. Activation re-gates nav/pages instantly;
 * the main process rejects downgrade keys.
 */
export function LicensePlanCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { formatDate } = useFormatDate()
  const license = useLicenseStore()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)

  // A legacy license (no plan, no feature list) has everything — show it as
  // the full plan. A feature list without a known plan name is "custom".
  const currentPlan: LicensePlanName | null =
    license.plan && (LICENSE_PLAN_ORDER as readonly string[]).includes(license.plan)
      ? (license.plan as LicensePlanName)
      : license.features == null
        ? 'full'
        : null

  const currentRank = currentPlan ? LICENSE_PLAN_ORDER.indexOf(currentPlan) : -1

  const currentPlanLabel = currentPlan
    ? t(PLAN_META[currentPlan].labelKey)
    : license.features == null
      ? t('license.planLegacy')
      : t('license.planCustom')

  const expiryLabel =
    license.state === 'lifetime' || (license.state === 'valid' && !license.expiresAt)
      ? t('license.lifetime')
      : license.expiresAt
        ? formatDate(license.expiresAt)
        : '—'

  const activateNewKey = async () => {
    const key = newKey.trim()
    if (!key) return
    setActivating(true)
    setActivateError(null)
    try {
      const result = await window.api.license.activate(key)
      if (!result.ok) {
        setActivateError(result.message)
        return
      }
      // Refresh the shared mirror so nav/pages re-gate immediately.
      useLicenseStore.getState().setLicense(await window.api.app.getLicenseStatus())
      setNewKey('')
      setUpgradeOpen(false)
      toast.success(t('license.keyUpdated'), result.issuedTo)
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : t('license.activateFailed'))
    } finally {
      setActivating(false)
    }
  }

  return (
    <Card
      title={t('license.planTitle')}
      description={t('license.planHint')}
      actions={
        <Button type="button" size="sm" onClick={() => setUpgradeOpen(true)}>
          <ArrowUpCircle className="size-4" />
          {t('license.upgradePlan')}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-brand-primary/15 bg-gradient-to-r from-brand-tint/50 to-surface-raised px-4 py-3 text-sm shadow-soft">
          <span className="text-ink-muted">
            {t('license.plan')}:{' '}
            <span className="font-semibold text-brand-primary">{currentPlanLabel}</span>
          </span>
          {license.issuedTo ? (
            <span className="text-ink-muted">
              {t('license.issuedTo')}:{' '}
              <span className="font-medium text-ink">{license.issuedTo}</span>
            </span>
          ) : null}
          <span className="text-ink-muted">
            {t('license.header')}:{' '}
            <span className="font-medium text-ink">{expiryLabel}</span>
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {LICENSE_PLAN_ORDER.map((plan, rank) => {
            const isCurrent = plan === currentPlan
            const isLower = currentRank >= 0 && rank < currentRank
            const isHigher = currentRank >= 0 ? rank > currentRank : !isCurrent
            const meta = PLAN_META[plan]
            const PlanIcon = meta.icon
            const planFeatures = LICENSE_PLAN_FEATURES[plan]
            const limits = LICENSE_PLAN_LIMITS[plan]
            const allLayouts = limits.maxTemplates >= 99
            return (
              <div
                key={plan}
                className={cn(
                  'relative flex flex-col rounded-xl border p-4 transition-all duration-pos',
                  isCurrent
                    ? 'border-brand-primary bg-gradient-to-b from-brand-tint/70 via-surface-raised to-surface-raised shadow-glow ring-1 ring-brand-primary/30'
                    : 'border-line/80 bg-surface-muted/30',
                  isLower && 'opacity-55',
                  isHigher && 'hover:-translate-y-0.5 hover:border-brand-primary/40 hover:shadow-lift',
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span
                    className={cn('grid size-10 place-items-center rounded-xl', meta.bubble)}
                    aria-hidden
                  >
                    <PlanIcon className="size-5" />
                  </span>
                  {isCurrent ? (
                    <Badge tone="success">
                      <Check className="size-3" aria-hidden /> {t('license.currentPlan')}
                    </Badge>
                  ) : null}
                </div>

                <p
                  className={cn(
                    'text-base font-bold tracking-tight',
                    isCurrent ? 'text-brand-primary' : 'text-ink',
                  )}
                >
                  {t(meta.labelKey)}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-surface-raised/80 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                    <UsersRound className="size-3" aria-hidden />
                    {limits.maxUsers === 1
                      ? t('license.usersOne')
                      : t('license.usersMany', { count: limits.maxUsers })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-surface-raised/80 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                    <Printer className="size-3" aria-hidden />
                    {allLayouts
                      ? t('license.layoutsAll')
                      : t('license.layoutsMany', { count: limits.maxTemplates })}
                  </span>
                </div>

                <ul className="mt-3 flex-1 space-y-1.5 border-t border-line/60 pt-3 text-xs">
                  {LICENSE_FEATURES.map((feature) => {
                    const included = planFeatures.includes(feature)
                    return (
                      <li key={feature} className="flex items-center gap-2">
                        {included ? (
                          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-success-soft">
                            <Check className="size-2.5 text-success" aria-hidden />
                          </span>
                        ) : (
                          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-surface-muted">
                            <Minus className="size-2.5 text-ink-subtle" aria-hidden />
                          </span>
                        )}
                        <span
                          className={cn(
                            included ? 'font-medium text-ink' : 'text-ink-subtle line-through opacity-80',
                          )}
                        >
                          {t(FEATURE_LABEL_KEYS[feature])}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {isHigher ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setUpgradeOpen(true)}
                  >
                    {t('license.upgradePlan')}
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={upgradeOpen}
        onClose={() => {
          setUpgradeOpen(false)
          setActivateError(null)
        }}
        title={t('license.upgradeTitle')}
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{t('license.newKeyHint')}</p>
          <TextField
            label={t('license.newKeyLabel')}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="KB-XXXX-XXXX-XXXX"
          />
          {activateError ? (
            <p className="text-sm text-danger" role="alert">
              {activateError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUpgradeOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              loading={activating}
              disabled={!newKey.trim()}
              onClick={() => void activateNewKey()}
            >
              <KeyRound className="size-4" />
              {t('license.activateNew')}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
