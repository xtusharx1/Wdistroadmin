import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminOverview } from '../../api'
import {
  PageLayout,
  PageHeader,
  SectionCard,
  Button,
  LoadingState,
} from '../../components/DesignSystem'
import StatusBadge from '../../components/StatusBadge'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtDecimal = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
const fmtDateFull = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

// ── Status color map for the donut chart ────────────────────────────────────
const STATUS_COLORS = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  processed: '#6366f1',
  dispatched: '#8b5cf6',
  delivered: '#10b981',
  completed: '#059669',
  cancelled: '#ef4444',
  rejected: '#f43f5e',
}

// ══════════════════════════════════════════════════════════════════════════════
// MINI-CHART COMPONENTS (pure SVG, no dependencies)
// ══════════════════════════════════════════════════════════════════════════════

/* ── Sparkline Bar Chart ─────────────────────────────────────────────────── */
function SalesBarChart({ data, height = 220 }) {
  const width = 680
  const padding = { top: 20, right: 16, bottom: 40, left: 60 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400 font-medium" style={{ height }}>
        No sales data for the past 30 days
      </div>
    )
  }

  const maxRev = Math.max(...data.map((d) => d.revenue), 1)
  const barWidth = Math.max(4, (chartW / data.length) * 0.65)
  const gap = chartW / data.length

  // Y-axis ticks (5 lines)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxRev / 4) * i))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map((tick) => {
        const y = padding.top + chartH - (tick / maxRev) * chartH
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-400" style={{ fontSize: 9 }}>
              ${tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.revenue / maxRev) * chartH
        const x = padding.left + i * gap + (gap - barWidth) / 2
        const y = padding.top + chartH - barH
        const showLabel = data.length <= 15 || i % Math.ceil(data.length / 10) === 0

        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barWidth} height={barH} rx={2} className="fill-indigo-500" opacity={0.85}>
              <title>{`${d.date}: $${d.revenue.toLocaleString()} (${d.orderCount} orders)`}</title>
            </rect>
            {showLabel && (
              <text
                x={x + barWidth / 2}
                y={padding.top + chartH + 16}
                textAnchor="middle"
                className="fill-gray-400"
                style={{ fontSize: 8 }}
              >
                {new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ── Donut Chart ─────────────────────────────────────────────────────────── */
function DonutChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-400 font-medium" style={{ width: size, height: size }}>
        No orders
      </div>
    )
  }

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 12
  const innerRadius = radius * 0.58
  let cumulative = 0

  const arcs = data.map((d) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    cumulative += d.count
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const ix1 = cx + innerRadius * Math.cos(endAngle)
    const iy1 = cy + innerRadius * Math.sin(endAngle)
    const ix2 = cx + innerRadius * Math.cos(startAngle)
    const iy2 = cy + innerRadius * Math.sin(startAngle)

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ')

    return { ...d, path }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map((a) => (
        <path key={a.status} d={a.path} fill={STATUS_COLORS[a.status] || '#94a3b8'} className="transition-opacity hover:opacity-80">
          <title>{`${a.status}: ${a.count}`}</title>
        </path>
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-800 font-bold" style={{ fontSize: 22 }}>
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-400 font-medium" style={{ fontSize: 10 }}>
        Total Orders
      </text>
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MINI KPI CARD (inline, no dependency on StatCard)
// ══════════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, sub, icon, color = 'indigo' }) {
  const colorMap = {
    indigo: 'from-indigo-50 to-indigo-100/50 border-indigo-200/60',
    green: 'from-emerald-50 to-emerald-100/50 border-emerald-200/60',
    amber: 'from-amber-50 to-amber-100/50 border-amber-200/60',
    red: 'from-red-50 to-red-100/50 border-red-200/60',
    blue: 'from-blue-50 to-blue-100/50 border-blue-200/60',
    purple: 'from-purple-50 to-purple-100/50 border-purple-200/60',
  }
  const iconColorMap = {
    indigo: 'bg-indigo-100 text-indigo-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
  }
  const valColor = {
    indigo: 'text-indigo-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    purple: 'text-purple-700',
  }

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl px-4 py-4 flex items-start gap-3 transition-shadow hover:shadow-md`}>
      {icon && <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconColorMap[color]}`}>{icon}</div>}
      <div>
        <p className="text-2xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{label}</p>
        <p className={`text-xl font-extrabold mt-0.5 ${valColor[color]}`}>{value}</p>
        {sub && <p className="text-2xs text-gray-400 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTENTION ITEM ROW
// ══════════════════════════════════════════════════════════════════════════════
function AttentionRow({ icon, label, count, actionLabel, to, color = 'amber' }) {
  const navigate = useNavigate()
  if (count === 0) return null

  const bg = { amber: 'bg-amber-50', red: 'bg-red-50', indigo: 'bg-indigo-50' }
  const iconBg = { amber: 'bg-amber-100 text-amber-600', red: 'bg-red-100 text-red-600', indigo: 'bg-indigo-100 text-indigo-600' }
  const badge = { amber: 'bg-amber-500', red: 'bg-red-500', indigo: 'bg-indigo-500' }

  return (
    <div className={`flex items-center justify-between gap-3 ${bg[color]} rounded-xl px-4 py-3 transition-all hover:shadow-sm`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${iconBg[color]}`}>{icon}</div>
        <span className="text-xs font-semibold text-gray-800 truncate">{label}</span>
        <span className={`${badge[color]} text-white text-3xs font-bold px-2 py-0.5 rounded-full`}>{count}</span>
      </div>
      <Button variant="secondary" className="shrink-0 text-3xs px-3 py-1.5" onClick={() => navigate(to)}>
        {actionLabel}
      </Button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR (for store / billing sections)
// ══════════════════════════════════════════════════════════════════════════════
function ProgressBar({ value, max, color = 'indigo', label, sub }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const colors = {
    indigo: 'bg-indigo-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  }

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs font-bold text-gray-900">{fmtNum(value)}{sub && <span className="text-gray-400 font-medium"> {sub}</span>}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════════════════
const Icons = {
  store: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  permit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  order: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  revenue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  box: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  invoice: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  today: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  avg: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminOverview()
      .then((res) => setData(res.data.data))
      .catch((err) => {
        console.error('Dashboard load error:', err)
        setError('Failed to load dashboard data.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <PageLayout><LoadingState message="Loading dashboard…" height="h-96" /></PageLayout>
  if (error || !data) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-sm font-semibold text-red-500">{error || 'Something went wrong.'}</p>
          <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
      </PageLayout>
    )
  }

  const { needsAttention, kpi, salesOverview, orderStatusDistribution, recentOrders, inventory, stores, billing, team } = data
  const totalAttention = needsAttention.pendingStoreApprovals + needsAttention.pendingPermits + needsAttention.pendingOrders

  return (
    <PageLayout>
      <PageHeader
        title="Dashboard"
        subtitle={`Operations overview · Last refreshed ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
        action={
          <Button variant="secondary" onClick={load} className="gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        }
      />

      {/* ═══ 1. NEEDS ATTENTION ═══ */}
      {totalAttention > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Needs Attention
              <span className="bg-amber-100 text-amber-700 text-3xs font-bold px-2 py-0.5 rounded-full">{totalAttention}</span>
            </span>
          }
        >
          <div className="space-y-2">
            <AttentionRow
              icon={Icons.store}
              label="Stores waiting for approval"
              count={needsAttention.pendingStoreApprovals}
              actionLabel="Review"
              to="/admin/stores"
              color="amber"
            />
            <AttentionRow
              icon={Icons.permit}
              label="Permits pending review"
              count={needsAttention.pendingPermits}
              actionLabel="Review"
              to="/admin/stores"
              color="indigo"
            />
            <AttentionRow
              icon={Icons.order}
              label="Pending orders"
              count={needsAttention.pendingOrders}
              actionLabel="View Orders"
              to="/admin/orders"
              color="red"
            />
          </div>
        </SectionCard>
      )}

      {/* ═══ 2. KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Total Orders" value={fmtNum(kpi.totalOrders)} icon={Icons.order} color="indigo" />
        <KpiCard label="Today's Orders" value={fmtNum(kpi.ordersToday)} icon={Icons.today} color="blue" />
        <KpiCard label="Pending Orders" value={fmtNum(kpi.ordersThisMonth)} sub="This month" icon={Icons.chart} color="purple" />
        <KpiCard label="Today's Sales" value={fmt(kpi.totalRevenue)} sub="Delivered / completed" icon={Icons.revenue} color="green" />
        <KpiCard label="This Month's Sales" value={fmt(kpi.revenueThisMonth)} icon={Icons.revenue} color="green" />
        <KpiCard label="Average Order Value" value={fmtDecimal(kpi.avgOrderValue)} icon={Icons.avg} color="amber" />
      </div>

      {/* ═══ 3 & 4. SALES OVERVIEW + ORDER STATUS ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sales Chart (2/3 width) */}
        <SectionCard title="Sales Overview — Last 30 Days" className="xl:col-span-2">
          <SalesBarChart data={salesOverview} />
        </SectionCard>

        {/* Order Status Donut (1/3 width) */}
        <SectionCard title="Order Status Breakdown">
          <div className="flex flex-col items-center gap-4">
            <DonutChart data={orderStatusDistribution} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full max-w-xs">
              {orderStatusDistribution.map((d) => (
                <div key={d.status} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: STATUS_COLORS[d.status] || '#94a3b8' }} />
                  <span className="text-gray-600 capitalize truncate">{d.status}</span>
                  <span className="font-bold text-gray-800 ml-auto">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ═══ 5. RECENT ORDERS ═══ */}
      <SectionCard
        title="Recent Orders"
        action={
          <Button variant="outlined" className="text-3xs" onClick={() => navigate('/admin/orders')}>
            View All Orders →
          </Button>
        }
      >
        {recentOrders.length === 0 ? (
          <p className="text-center text-gray-400 text-xs py-10 font-medium">No orders yet</p>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  {['Order ID', 'Store', 'Items', 'Total', 'Source', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-3xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => navigate('/admin/orders')}>
                    <td className="px-4 py-2.5 font-bold text-indigo-600">WS-{o.id}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{o.shop_name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{o.itemCount}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(o.total_amount)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-3xs font-bold px-1.5 py-0.5 rounded ${o.source === 'Admin' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                        {o.source || 'App'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2.5 text-gray-400 font-medium">{fmtDateFull(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ 6 & 7. INVENTORY + STORES ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory Snapshot */}
        <SectionCard
          title="Inventory Snapshot"
          action={
            <Button variant="outlined" className="text-3xs" onClick={() => navigate('/admin/inventory')}>
              Manage Inventory →
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Total Products</p>
                <p className="text-lg font-extrabold text-gray-800 mt-0.5">{fmtNum(inventory.totalProducts)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Stock Value</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{fmt(inventory.totalStockValue)}</p>
              </div>
            </div>
            <ProgressBar label="Active" value={inventory.activeProducts} max={inventory.totalProducts} color="green" />
            <ProgressBar label="Low Stock (≤10)" value={inventory.lowStockProducts} max={inventory.totalProducts} color="amber" />
            <ProgressBar label="Out of Stock" value={inventory.outOfStockProducts} max={inventory.totalProducts} color="red" />
          </div>
        </SectionCard>

        {/* Store Overview */}
        <SectionCard
          title="Store Overview"
          action={
            <Button variant="outlined" className="text-3xs" onClick={() => navigate('/admin/stores')}>
              Manage Stores →
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Total Stores</p>
                <p className="text-lg font-extrabold text-gray-800 mt-0.5">{fmtNum(stores.totalStores)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Team Members</p>
                <p className="text-lg font-extrabold text-indigo-700 mt-0.5">{fmtNum(team.sellers + team.execs)}</p>
                <p className="text-2xs text-gray-400 font-medium">{team.sellers} sellers · {team.execs} execs</p>
              </div>
            </div>
            <ProgressBar label="Approved" value={stores.approvedStores} max={stores.totalStores} color="green" />
            <ProgressBar label="Pending" value={stores.pendingStores} max={stores.totalStores} color="amber" />
            <ProgressBar label="Rejected" value={stores.rejectedStores} max={stores.totalStores} color="red" />
          </div>
        </SectionCard>
      </div>

      {/* ═══ 8. BILLING / INVOICE SUMMARY ═══ */}
      <SectionCard
        title="Billing & Invoices"
        action={
          <Button variant="outlined" className="text-3xs" onClick={() => navigate('/admin/invoices')}>
            View All Invoices →
          </Button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg px-3.5 py-3 text-center">
            <p className="text-2xs font-bold text-gray-400 uppercase tracking-wider">Total Invoices</p>
            <p className="text-xl font-extrabold text-gray-800 mt-1">{fmtNum(billing.totalInvoices)}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg px-3.5 py-3 text-center">
            <p className="text-2xs font-bold text-emerald-500 uppercase tracking-wider">Collected</p>
            <p className="text-xl font-extrabold text-emerald-700 mt-1">{fmt(billing.totalCollected)}</p>
          </div>
          <div className="bg-amber-50 rounded-lg px-3.5 py-3 text-center">
            <p className="text-2xs font-bold text-amber-500 uppercase tracking-wider">Outstanding</p>
            <p className="text-xl font-extrabold text-amber-700 mt-1">{fmt(billing.totalOutstanding)}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg px-3.5 py-3 text-center">
            <p className="text-2xs font-bold text-indigo-500 uppercase tracking-wider">Total Billed</p>
            <p className="text-xl font-extrabold text-indigo-700 mt-1">{fmt(billing.totalBilledAmount)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 bg-yellow-50/80 rounded-lg px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-xs text-gray-600 font-medium">Unsettled</span>
            <span className="ml-auto text-xs font-bold text-gray-800">{billing.unsettledInvoices}</span>
          </div>
          <div className="flex items-center gap-2 bg-orange-50/80 rounded-lg px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-xs text-gray-600 font-medium">Partial</span>
            <span className="ml-auto text-xs font-bold text-gray-800">{billing.partiallyPaidInvoices}</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50/80 rounded-lg px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-600 font-medium">Paid</span>
            <span className="ml-auto text-xs font-bold text-gray-800">{billing.paidInvoices}</span>
          </div>
        </div>
      </SectionCard>
    </PageLayout>
  )
}
