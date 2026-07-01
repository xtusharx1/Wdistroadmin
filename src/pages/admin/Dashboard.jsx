import { useState, useEffect } from 'react'
import { getDashboardStats } from '../../api'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then((res) => {
        setStats(res.data.data)
      })
      .catch((err) => {
        console.error('Failed to load dashboard stats:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>
  if (!stats) return <div className="p-4 sm:p-6 text-sm text-red-500">Failed to load dashboard statistics.</div>

  const {
    totalStores,
    pendingApprovals,
    approvedStores,
    totalOrders,
    pendingOrders,
    sellers,
    execs,
    totalRevenue,
    recentOrders
  } = stats

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Stores" value={totalStores} color="indigo" />
        <StatCard label="Pending Approvals" value={pendingApprovals} color="yellow" />
        <StatCard label="Approved Stores" value={approvedStores} color="green" />
        <StatCard label="Pending Orders" value={pendingOrders} color="red" />
        <StatCard label="Total Orders" value={totalOrders} color="indigo" />
        <StatCard label="Sellers" value={sellers} />
        <StatCard label="Sales Executives" value={execs} />
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} color="green" sub="Delivered orders" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Order ID', 'Store', 'Items', 'Total', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">WS-{o.id}</td>
                  <td className="px-4 py-2.5 text-gray-500">{o.shop_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{o.itemCount}</td>
                  <td className="px-4 py-2.5 font-medium">{fmt(o.total_amount)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2.5 text-gray-500">{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentOrders.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No orders yet</p>
        )}
      </div>
    </div>
  )
}
