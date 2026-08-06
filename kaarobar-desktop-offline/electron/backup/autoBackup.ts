import { createBackupInternal, isBackupBusy } from './service'
import { getAutoBackupSettings, markAutoBackupCompleted, normalizeAutoBackupTime } from '../config/store'

const CHECK_INTERVAL_MS = 45_000

let timer: ReturnType<typeof setInterval> | null = null
let running = false

function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function alreadyRanToday(lastAt: string | null): boolean {
  if (!lastAt) return false
  const last = new Date(lastAt)
  if (Number.isNaN(last.getTime())) return false
  return localDateKey(last) === localDateKey()
}

function isScheduledMinuteNow(timeHhMm: string, now = new Date()): boolean {
  const normalized = normalizeAutoBackupTime(timeHhMm)
  const [hh, mm] = normalized.split(':').map(Number)
  return now.getHours() === hh && now.getMinutes() === mm
}

export async function tickAutoBackup(): Promise<void> {
  if (running || isBackupBusy()) return

  const settings = getAutoBackupSettings()
  if (!settings.autoBackupEnabled) return
  if (!isScheduledMinuteNow(settings.autoBackupTime)) return
  if (alreadyRanToday(settings.lastAutoBackupAt)) return

  running = true
  try {
    await createBackupInternal()
    markAutoBackupCompleted()
  } catch (error) {
    console.error('[auto-backup] failed', error)
  } finally {
    running = false
  }
}

export function startAutoBackupScheduler(): void {
  if (timer) return
  void tickAutoBackup()
  timer = setInterval(() => {
    void tickAutoBackup()
  }, CHECK_INTERVAL_MS)
}

export function stopAutoBackupScheduler(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
}
