import { useState, useEffect } from 'react'
import { getShops, getUsers, getOrders } from '../../api'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

export default function AdminDashboard() {
  const [shops, setShops] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getShops(), getUsers(), getOrders()])
      .then(([s, u, o]) => {
        setShops(s.data.data.shops || [])
        setUsers(u.data.data.users || [])
        setOrders(o.data.data.orders || [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  const pending = shops.filter((s) => s.approval_status === 'Pending').length
  const approved = shops.filter((s) => s.approval_status === 'Approved').length
  const sellers = users.filter((u) => u.role === 'Seller').length
  const execs = users.filter((u) => u.role === 'Sales Executive').length
  const pendingOrders = orders.filter((o) => o.status === 'pending').length
  const revenue = orders
    .filter((o) => o.status === 'delivered' || o.status === 'completed')
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  const storeMap = shops.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {})

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Stores" value={shops.length} color="indigo" />
        <StatCard label="Pending Approvals" value={pending} color="yellow" />
        <StatCard label="Approved Stores" value={approved} color="green" />
        <StatCard label="Pending Orders" value={pendingOrders} color="red" />
        <StatCard label="Total Orders" value={orders.length} color="indigo" />
        <StatCard label="Sellers" value={sellers} />
        <StatCard label="Sales Executives" value={execs} />
        <StatCard label="Total Revenue" value={fmt(revenue)} color="green" sub="Delivered orders" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
        </div>
        <table className="w-full text-sm">
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
            {orders.slice(0, 10).map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">WS-{o.id}</td>
                <td className="px-4 py-2.5 text-gray-500">{storeMap[o.shop_id] || `Store #${o.shop_id}`}</td>
                <td className="px-4 py-2.5 text-gray-500">{o.OrderItems?.length ?? 0}</td>
                <td className="px-4 py-2.5 font-medium">{fmt(o.total_amount)}</td>
                <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-2.5 text-gray-500">{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No orders yet</p>
        )}
      </div>
    </div>
  )
}
