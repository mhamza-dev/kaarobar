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
import { EmptyState } from '../../../../components/ui'
import type { AnalyticsSummary } from '../../../../../shared/types/api'
import { useFormatCompactNumber, useFormatMoney } from '../../../../lib/useFormatMoney'
import { ChartTooltip } from './ChartTooltip'

type Props = {
  rows: AnalyticsSummary['topProducts']
  currency: string
}

export function TopProductsList({ rows, currency }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const formatCompact = useFormatCompactNumber()

  if (rows.length === 0) {
    return <EmptyState title={t('dashboard.noTopProducts')} description={t('dashboard.noTopProductsDesc')} />
  }

  const data = [...rows].reverse().map((row) => ({
    ...row,
    shortName:
      row.productName.length > 18 ? `${row.productName.slice(0, 16)}…` : row.productName,
  }))

  return (
    <div className="h-56 w-full sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="4 6" stroke="rgb(226 232 240)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'rgb(100 116 139)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={88}
            tick={{ fill: 'rgb(51 65 85)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgb(45 109 246)', fillOpacity: 0.08 }}
            content={(props) => {
              const item = props.payload?.[0]?.payload as
                | { productName?: string; revenue?: number; qty?: number }
                | undefined
              return (
                <ChartTooltip
                  active={props.active}
                  label={item?.productName}
                  payload={[
                    {
                      name: t('dashboard.tooltipRevenue'),
                      value: item?.revenue ?? 0,
                      color: 'rgb(45 109 246)',
                      dataKey: 'revenue',
                    },
                    {
                      name: t('dashboard.tooltipQty'),
                      value: item?.qty ?? 0,
                      color: 'rgb(100 116 139)',
                      dataKey: 'qty',
                    },
                  ]}
                  formatValue={(value, dataKey) =>
                    dataKey === 'qty'
                      ? String(Math.round(value))
                      : formatMoney(value, currency)
                  }
                />
              )
            }}
          />
          <Bar
            dataKey="revenue"
            name={t('dashboard.tooltipRevenue')}
            fill="rgb(45 109 246)"
            radius={[0, 6, 6, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
