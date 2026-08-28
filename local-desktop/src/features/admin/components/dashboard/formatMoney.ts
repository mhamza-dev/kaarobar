import { formatMoney, type FormatMoneyOptions } from '../../../../lib/formatMoney'

/** @deprecated Prefer formatMoney / useFormatMoney — kept for dashboard imports. */
export function formatDashboardMoney(
  value: number,
  currency: string,
  units?: Partial<FormatMoneyOptions>,
): string {
  return formatMoney(value, currency, units)
}
