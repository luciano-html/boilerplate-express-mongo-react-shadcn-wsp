import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Table2, TrendingUp } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Un solo tono para todo. La facturación es una serie sola y el top de
 * productos es una magnitud, no identidades: en ninguno de los dos casos el
 * color distingue nada, así que una paleta categórica sería decoración.
 * #E20019 es el primary del sistema y pasa las seis checks sobre fondo claro.
 */
const HUE = '#E20019'
const INK_MUTED = '#5b5b66'
const GRID = '#e6e6ea'

type Stats = {
  range: { from: string; to: string; groupBy: string }
  totals: { revenue: number; orders: number; avgTicket: number }
  cancelled: number
  series: { period: string; revenue: number; orders: number }[]
  byType: { key: string; revenue: number; orders: number }[]
  byPayment: { key: string; revenue: number; orders: number }[]
  topProducts: { name: string; units: number; revenue: number }[]
}

const money = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`
const shortMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`

const RANGES = [
  { key: '7', label: '7 días', days: 7, groupBy: 'day' },
  { key: '30', label: '30 días', days: 30, groupBy: 'day' },
  { key: '90', label: '3 meses', days: 90, groupBy: 'day' },
  { key: '365', label: '12 meses', days: 365, groupBy: 'month' },
]

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** El período tal como lo entiende alguien que mira, no como lo guarda Mongo. */
function labelPeriod(period: string, groupBy: string) {
  if (groupBy === 'month') {
    const [y, m] = period.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
  }
  const [y, m, d] = period.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="font-heading text-[26px] font-bold leading-none">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/** Dos categorías no necesitan un gráfico: necesitan dos números y su proporción. */
function Breakdown({
  title,
  rows,
  labels,
}: {
  title: string
  rows: { key: string; revenue: number; orders: number }[]
  labels: Record<string, string>
}) {
  const total = rows.reduce((acc, r) => acc + r.revenue, 0)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Sin datos en el período.</p>}
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.revenue / total) * 100) : 0
        return (
          <div key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{labels[row.key] ?? row.key}</span>
              <span className="text-sm font-bold">
                {money(row.revenue)} <span className="font-normal text-muted-foreground">· {pct}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: HUE }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {row.orders} {row.orders === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function Ganancias() {
  const [rangeKey, setRangeKey] = useState('30')
  const [showTable, setShowTable] = useState(false)

  const range = RANGES.find((r) => r.key === rangeKey)!

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['order-stats', rangeKey],
    queryFn: () =>
      api
        .get(`/orders/stats?from=${isoDaysAgo(range.days)}&groupBy=${range.groupBy}`)
        .then((res) => res.data),
  })

  const series = useMemo(
    () => (data?.series ?? []).map((p) => ({ ...p, label: labelPeriod(p.period, data!.range.groupBy) })),
    [data]
  )

  const top = data?.topProducts ?? []
  const maxUnits = Math.max(1, ...top.map((t) => t.units))

  if (isLoading) return <div className="p-4">Cargando ganancias...</div>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Ganancias</h1>
          <p className="text-sm text-muted-foreground">
            Solo cuenta lo entregado. Los pedidos cancelados se muestran aparte, no facturan.
          </p>
        </div>

        {/* Filtros en una fila arriba de los gráficos. */}
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              className={cn(
                'cursor-pointer rounded-md px-3 py-1.5 text-[13px] transition-colors',
                rangeKey === r.key ? 'bg-secondary font-semibold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Facturación" value={money(data?.totals.revenue ?? 0)} />
        <StatTile label="Pedidos" value={String(data?.totals.orders ?? 0)} />
        <StatTile label="Ticket promedio" value={money(data?.totals.avgTicket ?? 0)} />
        <StatTile
          label="Cancelados"
          value={String(data?.cancelled ?? 0)}
          hint={data?.cancelled ? 'No suman a la facturación' : undefined}
        />
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
            <TrendingUp size={18} style={{ color: HUE }} />
            Facturación por {range.groupBy === 'month' ? 'mes' : 'día'}
          </h2>
          {/* Una vista de tabla siempre disponible: el color no puede ser el
              único camino al dato. */}
          <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)}>
            <Table2 size={14} className="mr-2" />
            {showTable ? 'Ver gráfico' : 'Ver tabla'}
          </Button>
        </div>

        {series.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sin ventas en este período.</p>
        ) : showTable ? (
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 font-semibold">Período</th>
                  <th className="py-2 text-right font-semibold">Pedidos</th>
                  <th className="py-2 text-right font-semibold">Facturación</th>
                </tr>
              </thead>
              <tbody>
                {series.map((row) => (
                  <tr key={row.period} className="border-t border-border">
                    <td className="py-2">{row.label}</td>
                    <td className="py-2 text-right tabular-nums">{row.orders}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={HUE} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={HUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Grilla recesiva: solo horizontales, para leer alturas. */}
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: INK_MUTED, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: INK_MUTED, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={shortMoney}
                />
                <Tooltip
                  cursor={{ stroke: INK_MUTED, strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as (typeof series)[number]
                    return (
                      <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
                        <div className="font-semibold">{p.label}</div>
                        <div className="text-muted-foreground">
                          {p.orders} {p.orders === 1 ? 'pedido' : 'pedidos'}
                        </div>
                        <div className="font-bold">{money(p.revenue)}</div>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={HUE}
                  strokeWidth={2}
                  fill="url(#revFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Lo que más se vende</h2>
          {top.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin ventas en este período.</p>
          ) : (
            <div className="w-full" style={{ height: Math.max(160, top.length * 38) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fill: INK_MUTED, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as (typeof top)[number]
                      return (
                        <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">{p.units} unidades</div>
                          <div className="font-bold">{money(p.revenue)}</div>
                        </div>
                      )
                    }}
                  />
                  {/* Punta redondeada de 4px anclada a la línea base. */}
                  <Bar dataKey="units" radius={[0, 4, 4, 0]} barSize={14} label={{
                    position: 'right',
                    fill: INK_MUTED,
                    fontSize: 12,
                    formatter: (v: number) => `${v} u.`,
                  }}>
                    {top.map((t) => (
                      // Magnitud, no identidad: un solo tono, la intensidad
                      // sigue al valor. Nueve colores acá no dirían nada.
                      <Cell key={t.name} fill={HUE} fillOpacity={0.35 + 0.65 * (t.units / maxUnits)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <Breakdown
            title="Delivery vs. retiro"
            rows={data?.byType ?? []}
            labels={{ delivery: 'Delivery', takeaway: 'Retiro en local' }}
          />
          <Breakdown
            title="Medio de pago"
            rows={data?.byPayment ?? []}
            labels={{ cash: 'Efectivo', transfer: 'Transferencia' }}
          />
        </div>
      </div>
    </div>
  )
}
