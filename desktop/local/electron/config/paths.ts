import path from 'node:path'
import { app } from 'electron'

/**
 * Stable app data directory across dev/prod.
 * Avoids reset loops when app name/path differs between runs.
 */
export function getKaarobarDataDir(): string {
  return path.join(app.getPath('appData'), 'Kaarobar')
}

export function getAssetsDir(): string {
  return path.join(getKaarobarDataDir(), 'assets')
}
