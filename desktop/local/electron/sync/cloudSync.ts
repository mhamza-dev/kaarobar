import { BrowserWindow } from 'electron'
import { getLicenseEnforcement } from '../config/store'
import { verifyLicenseNow } from '../licensing/remoteVerify'
import { syncCustomersNow } from './customerSync'
import { IPC_CHANNELS } from '../../shared/types/api'

/**
 * The quarter-hour job: check the license with the server, then push the
 * customer book up.
 *
 * One timer for both, and in that order, because the order is the policy. A
 * device whose license the server has just refused should not spend the same
 * tick uploading data — and `sync_customers` would refuse it anyway, so asking
 * would only produce a confusing error in the log.
 */

const INTERVAL_MS = 15 * 60 * 1000

/**
 * The first run waits a little. Boot is the busiest moment in the app's life —
 * migrations, the window, the database — and the license was already checked at
 * activation, so nothing is gained by racing them.
 */
const FIRST_RUN_DELAY_MS = 30_000

let timer: ReturnType<typeof setInterval> | null = null
let firstRun: ReturnType<typeof setTimeout> | null = null
let running = false

/**
 * A run. Never throws: this is a background job, and an unhandled rejection in
 * the main process is a crashed till.
 */
export async function runCloudSync(): Promise<void> {
  if (running) return
  running = true
  try {
    const lockBefore = getLicenseEnforcement().blockedReason
    const license = await verifyLicenseNow()
    const lockAfter = getLicenseEnforcement().blockedReason

    // Only when the verdict actually moved. Tell the windows straight away
    // rather than leaving the cashier on a screen that no longer matches the
    // truth underneath it — locked out with a customer waiting, or still locked
    // a minute after support fixed their key. Both directions matter.
    if (lockBefore !== lockAfter) notifyRenderers()

    if (license.state === 'blocked') return

    const sync = await syncCustomersNow()
    if (sync.state === 'synced' && (sync.pushed || sync.deleted)) {
      console.info(
        `[cloud-sync] customers pushed=${sync.pushed} deleted=${sync.deleted} pending=${sync.pending}`,
      )
    }
  } catch (error) {
    // Nothing above is supposed to throw; if it does, the shop keeps selling.
    console.error('[cloud-sync] tick failed:', error)
  } finally {
    running = false
  }
}

/** Nudge every open window to re-read the license status now. */
function notifyRenderers(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send(IPC_CHANNELS.LICENSE_CHANGED)
  }
}

export function startCloudSyncScheduler(): void {
  if (timer) return
  firstRun = setTimeout(() => {
    void runCloudSync()
  }, FIRST_RUN_DELAY_MS)
  timer = setInterval(() => {
    void runCloudSync()
  }, INTERVAL_MS)
}

export function stopCloudSyncScheduler(): void {
  if (firstRun) {
    clearTimeout(firstRun)
    firstRun = null
  }
  if (!timer) return
  clearInterval(timer)
  timer = null
}
