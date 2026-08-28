import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import type { AnalyticsSummary } from '../../../../../shared/types/api'
import { useFormatCompactNumber, useFormatMoney } from '../../../../lib/useFormatMoney'
import { ChartTooltip } from './ChartTooltip'

type Props = {
  points: AnalyticsSummary['salesByDay']
  currency: string
}

function shortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[1]}/${parts[2]}`
}

export function SalesTrendChart({ points, currency }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const formatCompact = useFormatCompactNumber()
  const data = points.map((p) => ({
    ...p,
    label: shortDate(p.date),
  }))
  const peak = Math.max(...points.map((p) => p.total), 0)

  return (
    <div>
      <div className="h-56 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(45 109 246)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="rgb(45 109 246)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 6" stroke="rgb(226 232 240)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'rgb(100 116 139)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'rgb(100 116 139)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: 'rgb(45 109 246)', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  label={
                    typeof props.label === 'string'
                      ? points.find((p) => shortDate(p.date) === props.label)?.date ?? props.label
                      : undefined
                  }
                  payload={props.payload}
                  formatValue={(value) => formatMoney(value, currency)}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="total"
              name={t('dashboard.tooltipRevenue')}
              stroke="rgb(45 109 246)"
              strokeWidth={2.5}
              fill="url(#salesAreaFill)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {t('dashboard.peakDay')}: {formatMoney(peak, currency)}
      </p>
    </div>
  )
}
