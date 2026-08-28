import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { COMPANY_NAME, PRODUCT_NAME } from '../../../shared/branding'
import { KaarobarLogo } from '../brand'
import { FadeIn } from '../ui'

type AuthShellProps = {
  children: ReactNode
  /** Content column width — desktop-first form comfort */
  width?: 'md' | 'lg' | 'xl'
  /** Brand block alignment */
  brandAlign?: 'center' | 'start'
  /** Optional page title under the brand mark */
  title?: ReactNode
  /** Supporting line under brand / title */
  tagline?: ReactNode
  /** Extra row under brand (progress, badge, etc.) */
  headerExtra?: ReactNode
  /** Optional top-end actions (e.g. language) */
  headerActions?: ReactNode
  className?: string
  contentClassName?: string
}

const widthClass = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
} as const

/**
 * Atmospheric chrome for Sign-in, license gate, and setup wizard.
 * Brand + form as one composition — no AppShell chrome.
 */
export function AuthShell({
  children,
  width = 'md',
  brandAlign = 'center',
  title,
  tagline,
  headerExtra,
  headerActions,
  className,
  contentClassName,
}: AuthShellProps) {
  const { t } = useTranslation()
  const centered = brandAlign === 'center'

  return (
    <div className={cn('app-ambient relative min-h-screen overflow-hidden', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(rgb(var(--ink-subtle) / 0.22) 0.6px, transparent 0.6px)',
          backgroundSize: '18px 18px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, black, transparent)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 top-1/3 size-[28rem] rounded-full bg-brand-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-20 bottom-0 size-[22rem] rounded-full bg-brand-tint/80 blur-3xl"
      />

      <div
        className={cn(
          'relative mx-auto flex min-h-screen w-full flex-col justify-center px-4 py-8 sm:px-6 sm:py-10',
          widthClass[width],
          contentClassName,
        )}
      >
        {headerActions ? (
          <div className="mb-4 flex justify-end">{headerActions}</div>
        ) : null}

        <FadeIn>
          <header className={cn('mb-6 space-y-4', centered ? 'text-center' : 'text-start')}>
            <div
              className={cn(
                'flex gap-3',
                centered ? 'flex-col items-center' : 'items-start',
              )}
            >
              <KaarobarLogo
                className={cn(centered ? 'size-16' : 'size-12')}
                mark={!centered}
              />
              <div className={cn('space-y-1', !centered && 'min-w-0 flex-1')}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">
                  {PRODUCT_NAME}
                </p>
                {title ? (
                  <h1
                    className={cn(
                      'text-2xl font-bold tracking-tight text-ink',
                      centered && 'mx-auto max-w-sm',
                    )}
                  >
                    {title}
                  </h1>
                ) : null}
                {tagline ? (
                  <div
                    className={cn(
                      'text-sm leading-relaxed text-ink-muted',
                      centered && 'mx-auto max-w-sm',
                    )}
                  >
                    {tagline}
                  </div>
                ) : null}
              </div>
            </div>
            {headerExtra}
          </header>
        </FadeIn>

        <div className="relative min-w-0">{children}</div>

        <p
          className={cn(
            'mt-8 text-xs text-ink-subtle',
            centered ? 'text-center' : 'text-start',
          )}
        >
          {t('auth.madeBy', { company: COMPANY_NAME })}
        </p>
      </div>
    </div>
  )
}
