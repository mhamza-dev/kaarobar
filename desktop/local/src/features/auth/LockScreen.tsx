import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Lock, LogOut, Unlock } from 'lucide-react'
import { Button, TextField } from '../../components/ui'
import { useLockStore } from '../../stores/lockStore'
import { KaarobarLogo } from '../../components/brand'
import type { SessionUser } from '../../../shared/types/api'

type Props = {
  user: SessionUser
  onLogout: () => void
}

/**
 * Full-screen blocking lock overlay. Everything behind it is frosted out and
 * unreachable; only the signed-in user's password (or logging out to switch
 * users) gets past it.
 */
export function LockScreen({ user, onLogout }: Props) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tryUnlock = async () => {
    if (!password || checking) return
    setChecking(true)
    setError(null)
    try {
      const result = await window.api.auth.verifyPassword(password)
      if (result.ok) {
        setPassword('')
        useLockStore.getState().unlock()
      } else {
        setError(t('auth.wrongPassword'))
      }
    } catch {
      setError(t('auth.wrongPassword'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-surface-muted/70 p-4 backdrop-blur-2xl backdrop-saturate-150"
      role="dialog"
      aria-modal="true"
      aria-label={t('auth.lockedTitle')}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-sm rounded-2xl border border-line/60 bg-surface-raised/90 p-6 shadow-lift ring-1 ring-white/20 backdrop-blur-xl"
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <KaarobarLogo className="mb-4 h-8 w-auto" />
          <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand-primary shadow-soft">
            <Lock className="size-5" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-ink">{t('auth.lockedTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('auth.lockedDesc')}</p>
          <p className="mt-2 text-xs text-ink-subtle">
            {t('common.signedInAs')}{' '}
            <span className="font-medium text-ink-muted">{user.name}</span>
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void tryUnlock()
          }}
        >
          <TextField
            type="password"
            autoFocus
            label={t('auth.password')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={checking} disabled={!password}>
            <Unlock className="size-4" />
            {t('auth.unlock')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onLogout}
          >
            <LogOut className="size-4" />
            {t('common.logout')}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
