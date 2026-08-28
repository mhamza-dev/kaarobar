/** Business vertical — drives catalog kinds and POS features. */

export type BusinessNature = 'retail' | 'food' | 'salon' | 'services'

export type ProductKind = 'item' | 'service' | 'package' | 'deal'

export type ServiceMode = 'dine_in' | 'takeaway' | 'delivery'

export const BUSINESS_NATURES: BusinessNature[] = ['retail', 'food', 'salon', 'services']

export function isBusinessNature(value: unknown): value is BusinessNature {
  return typeof value === 'string' && (BUSINESS_NATURES as string[]).includes(value)
}

export function normalizeBusinessNature(value: unknown): BusinessNature {
  return isBusinessNature(value) ? value : 'retail'
}

/** Product kinds allowed for a nature (UI select options). */
export function kindsForNature(nature: BusinessNature): ProductKind[] {
  switch (nature) {
    case 'retail':
      return ['item']
    case 'food':
      return ['item', 'deal']
    case 'salon':
    case 'services':
      return ['service', 'package', 'deal', 'item']
    default:
      return ['item']
  }
}

export function defaultTracksStock(kind: ProductKind): boolean {
  return kind === 'item'
}

export function showsTables(nature: BusinessNature): boolean {
  return nature === 'food'
}

export function showsServiceMode(nature: BusinessNature): boolean {
  return nature === 'food'
}

export function showsServedBy(nature: BusinessNature): boolean {
  return nature === 'salon' || nature === 'services'
}

export function showsKindSelector(nature: BusinessNature): boolean {
  return kindsForNature(nature).length > 1
}

export function isValidProductKind(nature: BusinessNature, kind: ProductKind): boolean {
  return kindsForNature(nature).includes(kind)
}
