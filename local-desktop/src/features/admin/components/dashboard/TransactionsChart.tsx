import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import type { AnalyticsSummary } from '../../../../../shared/types/api'
import { ChartTooltip } from './ChartTooltip'

type Props = {
  points: AnalyticsSummary['salesByDay']
}

function shortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  return `${parts[1]}/${parts[2]}`
}

export function TransactionsChart({ points }: Props) {
  const { t } = useTranslation()
  const data = points.map((p) => ({
    ...p,
    label: shortDate(p.date),
  }))

  return (
    <div className="h-56 w-full sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" stroke="rgb(226 232 240)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgb(100 116 139)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'rgb(100 116 139)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ fill: 'rgb(45 109 246)', fillOpacity: 0.08 }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={
                  typeof props.label === 'string'
                    ? points.find((p) => shortDate(p.date) === props.label)?.date ?? props.label
                    : undefined
                }
                payload={props.payload}
                formatValue={(value) => String(Math.round(value))}
              />
            )}
          />
          <Bar
            dataKey="count"
            name={t('dashboard.tooltipSales')}
            fill="rgb(15 118 110)"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
