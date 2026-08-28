import type { TFunction } from 'i18next'

function humanizeStatus(status: string): string {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export type StatusKind = 'sale' | 'refund' | 'po'

export function statusLabel(t: TFunction, kind: StatusKind, status: string): string {
  return t(`statuses.${kind}.${status}`, { defaultValue: humanizeStatus(status) })
}

export function saleStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  if (status === 'completed') return 'success'
  if (status === 'partially_refunded') return 'warning'
  if (status === 'refunded' || status === 'void') return 'danger'
  return 'brand'
}

export function refundStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'pending') return 'warning'
  return 'neutral'
}

export function poStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  if (status === 'received') return 'success'
  if (status === 'partially_received' || status === 'ordered') return 'warning'
  if (status === 'cancelled') return 'danger'
  if (status === 'draft') return 'neutral'
  return 'brand'
}
