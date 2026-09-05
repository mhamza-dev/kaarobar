import { BrowserWindow } from 'electron'
import { getLicenseStatus } from '../licensing/service'
import {
  computeRestockAlertsForBusiness,
  listActiveBusinessIds,
} from '../inventory/restockAlerts'
import { IPC_CHANNELS, type DailyReminderEvent, type RestockAlert } from '../../shared/types/api'

const LICENSE_WARN_DAYS = 7

let running = false

function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysUntil(iso: string, now = new Date()): number {
  const target = new Date(iso).getTime()
  if (!Number.isFinite(target)) return Number.POSITIVE_INFINITY
  return (target - now.getTime()) / (24 * 60 * 60 * 1000)
}

function buildLicenseReminder(now = new Date()): DailyReminderEvent['license'] {
  const status = getLicenseStatus()
  if (status.status === 'none') {
    return { kind: 'missing', expiresAt: null, issuedTo: null, daysLeft: null }
  }
  if (status.status === 'expired') {
    return {
      kind: 'expired',
      expiresAt: status.record.expiresAt,
      issuedTo: status.record.issuedTo,
      daysLeft: 0,
    }
  }
  // Refused by the license server rather than run out locally — same message to
  // the shopkeeper, who needs a working key either way.
  if (status.status === 'blocked') {
    return {
      kind: 'missing',
      expiresAt: status.record.expiresAt,
      issuedTo: status.record.issuedTo,
      daysLeft: null,
    }
  }
  if (!status.record.expiresAt) {
    return null
  }
  const left = daysUntil(status.record.expiresAt, now)
  if (left > LICENSE_WARN_DAYS) return null
  return {
    kind: 'expiring',
    expiresAt: status.record.expiresAt,
    issuedTo: status.record.issuedTo,
    daysLeft: Math.max(0, Math.ceil(left)),
  }
}

function collectRestockAlerts(): RestockAlert[] {
  const businessIds = listActiveBusinessIds()
  const merged: RestockAlert[] = []
  for (const businessId of businessIds) {
    try {
      merged.push(...computeRestockAlertsForBusiness(businessId))
    } catch (error) {
      console.error('[daily-reminders] restock failed', businessId, error)
    }
  }
  merged.sort((a, b) => a.daysLeft - b.daysLeft || a.stockQty - b.stockQty)
  return merged
}

function broadcast(event: DailyReminderEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(IPC_CHANNELS.REMINDERS_DAILY, event)
  }
}

/** Build + broadcast reminders (panel only — no OS notification). Runs on every login. */
export function runDailyReminderJob(now = new Date()): DailyReminderEvent {
  const restock = collectRestockAlerts()
  const license = buildLicenseReminder(now)
  const event: DailyReminderEvent = {
    date: localDateKey(now),
    at: now.toISOString(),
    restock,
    license,
  }
  broadcast(event)
  return event
}

/** Called from renderer after login / session hydrate. */
export function maybeRunDailyReminders(): { ran: boolean } {
  if (running) return { ran: false }
  running = true
  try {
    runDailyReminderJob()
    return { ran: true }
  } catch (error) {
    console.error('[daily-reminders] failed', error)
    return { ran: false }
  } finally {
    running = false
  }
}
