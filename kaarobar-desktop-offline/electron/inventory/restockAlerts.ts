import { getDb, openDatabase } from '../db/connection'
import { runMigrations } from '../db/migrations'
import type { RestockAlert } from '../../shared/types/api'

const WINDOW_DAYS = 7
const ALERT_DAYS_THRESHOLD = 3

type CachedAlerts = {
  atMs: number
  alerts: RestockAlert[]
}

const cache = new Map<string, CachedAlerts>()

function sinceIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - (days - 1))
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function ensureDb() {
  openDatabase()
  runMigrations(getDb())
  return getDb()
}

export function listActiveBusinessIds(): string[] {
  const db = ensureDb()
  const rows = db.prepare('SELECT id FROM businesses WHERE is_active = 1').all() as Array<{ id: string }>
  return rows.map((r) => r.id)
}

export function computeRestockAlertsForBusiness(businessId: string): RestockAlert[] {
  const db = ensureDb()
  const since = sinceIso(WINDOW_DAYS)
  const rows = db
    .prepare(
      `
      WITH recent_sales AS (
        SELECT
          si.product_id AS product_id,
          SUM(MAX(si.qty - COALESCE(si.refunded_qty, 0), 0)) AS qty_sold
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = ? AND s.created_at >= ? AND s.status != 'void'
        GROUP BY si.product_id
      )
      SELECT
        p.id,
        p.name,
        p.stock_qty,
        COALESCE(rs.qty_sold, 0) AS qty_sold
      FROM products p
      LEFT JOIN recent_sales rs ON rs.product_id = p.id
      WHERE p.business_id = ? AND p.is_active = 1 AND p.tracks_stock = 1
      ORDER BY p.name ASC
    `,
    )
    .all(businessId, since, businessId) as Array<{
    id: string
    name: string
    stock_qty: number
    qty_sold: number
  }>

  const alerts: RestockAlert[] = []
  for (const row of rows) {
    const avgDailyQty = row.qty_sold / WINDOW_DAYS
    if (avgDailyQty <= 0) continue
    const daysLeft = row.stock_qty / avgDailyQty
    if (daysLeft > ALERT_DAYS_THRESHOLD) continue
    const recommendedQty = Math.max(0, Math.ceil(avgDailyQty * 7 - row.stock_qty))
    alerts.push({
      productId: row.id,
      productName: row.name,
      stockQty: row.stock_qty,
      avgDailyQty: Number(avgDailyQty.toFixed(2)),
      daysLeft: Number(daysLeft.toFixed(1)),
      recommendedQty,
    })
  }

  alerts.sort((a, b) => a.daysLeft - b.daysLeft || a.stockQty - b.stockQty)
  cache.set(businessId, { atMs: Date.now(), alerts })
  return alerts
}

export function getRestockAlertsForBusiness(businessId: string): RestockAlert[] {
  const cached = cache.get(businessId)
  if (cached && Date.now() - cached.atMs < 30 * 60 * 1000) {
    return cached.alerts
  }
  return computeRestockAlertsForBusiness(businessId)
}

