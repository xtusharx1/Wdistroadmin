import { useState, useEffect } from 'react'
import { getDashboardStats } from '../../api'
import StatCard from '../../components/StatCard'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`

export default function SalesDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardStats()
      .then((res) => {
        setStats(res.data.data)
      })
      .catch((err) => {
        console.error('Failed to load sales dashboard stats:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>
  if (!stats) return <div className="p-4 sm:p-6 text-sm text-red-500">Failed to load dashboard statistics.</div>

  const {
    assignedStoresCount,
    ordersToday,
    ordersThisMonth,
    deliveredOrders,
    totalSalesValue,
    generatedInvoices
  } = stats

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Sales Executive overview for your assigned stores.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="Assigned Stores" value={assignedStoresCount} color="indigo" />
        <StatCard label="Orders Today" value={ordersToday} color="blue" />
        <StatCard label="Orders This Month" value={ordersThisMonth} color="blue" />
        <StatCard label="Delivered Orders" value={deliveredOrders} color="green" />
        <StatCard label="Total Sales Value" value={fmt(totalSalesValue)} color="green" sub="Delivered/Completed orders" />
        <StatCard label="Generated Invoices" value={generatedInvoices} color="yellow" />
      </div>
    </div>
  )
}
