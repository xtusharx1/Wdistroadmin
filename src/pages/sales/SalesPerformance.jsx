import { useState, useEffect } from 'react'
import { getIncentives } from '../../api'
import StatusBadge from '../../components/StatusBadge'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')

export default function SalesPerformance() {
  const [performance, setPerformance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getIncentives()
      .then((res) => {
        setPerformance(res.data.data.performance || [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Calculate totals
  const totalSales = performance.reduce((sum, item) => sum + (item.order?.total_amount || 0), 0)
  const totalOrders = performance.length
  
  // Find unique stores
  const uniqueStores = new Set(performance.map(p => p.shop?.id)).size

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">My Sales Performance</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of your sales volume and orders driven across all assigned stores
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sales Driven</span>
          <span className="text-2xl font-bold text-indigo-700 mt-2">{fmt(totalSales)}</span>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Orders</span>
          <span className="text-2xl font-bold text-gray-900 mt-2">{totalOrders}</span>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stores Handled</span>
          <span className="text-2xl font-bold text-gray-900 mt-2">{uniqueStores}</span>
        </div>
      </div>

      {/* Sales Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Order Log</h3>
          <span className="text-xs text-gray-500 font-medium">Includes past and active store orders</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Order ID', 'Store Name', 'Order Date', 'Status', 'Order Amount'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {performance.map((record) => (
              <tr key={record.order?.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">WS-{record.order?.id}</td>
                <td className="px-4 py-3.5 text-gray-700">{record.shop?.shop_name || `Store #${record.shop?.id}`}</td>
                <td className="px-4 py-3.5 text-gray-500">{fmtDate(record.order?.created_at)}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={record.order?.status} />
                </td>
                <td className="px-4 py-3.5 font-semibold text-gray-900">{fmt(record.order?.total_amount)}</td>
              </tr>
            ))}
            {performance.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-gray-400 py-12">No orders recorded for your assignments.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
