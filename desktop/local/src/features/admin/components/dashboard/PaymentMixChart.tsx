import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import type { AnalyticsSummary } from '../../../../../shared/types/api'
import { useFormatCompactNumber, useFormatMoney } from '../../../../lib/useFormatMoney'
import { paymentMethodI18nKey } from '../../../../lib/paymentMethodI18n'
import { ChartTooltip } from './ChartTooltip'

type Props = {
  rows: AnalyticsSummary['paymentsByMethod']
  currency: string
}

const METHOD_COLORS: Record<string, string> = {
  cash: 'rgb(22 163 74)',
  card: 'rgb(45 109 246)',
  credit: 'rgb(217 119 6)',
}

export function PaymentMixChart({ rows, currency }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const formatCompact = useFormatCompactNumber()
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const data = rows.map((row) => ({
    ...row,
    label: t(paymentMethodI18nKey(row.method), { defaultValue: row.method }),
    pct: total > 0 ? (row.total / total) * 100 : 0,
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
          />
          <YAxis
            tick={{ fill: 'rgb(100 116 139)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
              tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            cursor={{ fill: 'rgb(15 23 42)', fillOpacity: 0.04 }}
            content={(props) => {
              const item = props.payload?.[0]?.payload as
                | { label?: string; total?: number; pct?: number; method?: string }
                | undefined
              return (
                <ChartTooltip
                  active={props.active}
                  label={item?.label}
                  payload={[
                    {
                      name: t('dashboard.tooltipRevenue'),
                      value: item?.total ?? 0,
                      color: item?.method ? METHOD_COLORS[item.method] : undefined,
                      dataKey: 'total',
                    },
                    {
                      name: t('dashboard.tooltipShare'),
                      value: item?.pct ?? 0,
                      color: 'rgb(100 116 139)',
                      dataKey: 'pct',
                    },
                  ]}
                  formatValue={(value, dataKey) =>
                    dataKey === 'pct' ? `${value.toFixed(0)}%` : formatMoney(value, currency)
                  }
                />
              )
            }}
          />
          <Bar dataKey="total" name={t('dashboard.tooltipRevenue')} radius={[8, 8, 0, 0]} maxBarSize={56}>
            {data.map((row) => (
              <Cell key={row.method} fill={METHOD_COLORS[row.method] ?? 'rgb(45 109 246)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
