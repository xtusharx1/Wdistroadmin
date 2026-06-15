import { useState, useEffect } from 'react'
import { getIncentives, getUsers } from '../../api'
import StatusBadge from '../../components/StatusBadge'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')

export default function AdminSalesPerformance() {
  const [executives, setExecutives] = useState([])
  const [performance, setPerformance] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedExecId, setSelectedExecId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    Promise.all([getUsers(), getIncentives()]).then(([uRes, pRes]) => {
      const allUsers = uRes.data.data.users || []
      const salesExecs = allUsers.filter(u => u.role === 'Sales Executive')
      setExecutives(salesExecs)
      
      const perf = pRes.data.data.performance || []
      setPerformance(perf)

      if (salesExecs.length > 0) {
        setSelectedExecId(salesExecs[0].id)
      }
    }).finally(() => setLoading(false))
  }, [])

  // Calculate salesperson stats
  const getExecStats = (execId) => {
    const execOrders = performance.filter(p => p.sales_exec?.id === execId)
    const totalSales = execOrders.reduce((sum, item) => sum + (item.order?.total_amount || 0), 0)
    return {
      ordersCount: execOrders.length,
      totalSales,
      orders: execOrders
    }
  }

  const selectedExec = executives.find(e => e.id === selectedExecId)
  const selectedStats = selectedExec ? getExecStats(selectedExecId) : { ordersCount: 0, totalSales: 0, orders: [] }

  const filteredExecutives = executives.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
      <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Executive Performance</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Track sales volume and orders driven by each salesperson (including past assignments)
          </p>
        </div>
        <input
          type="text"
          placeholder="Search salesperson..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
        />
      </div>

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Left Pane: Salesperson Master List */}
        <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Sales Executives
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredExecutives.map((exec) => {
              const stats = getExecStats(exec.id)
              const isSelected = exec.id === selectedExecId
              return (
                <button
                  key={exec.id}
                  onClick={() => setSelectedExecId(exec.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors flex flex-col gap-1 focus:outline-none ${
                    isSelected ? 'bg-indigo-50 border-r-4 border-indigo-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-semibold text-sm text-gray-900">{exec.name}</span>
                  <span className="text-xs text-gray-500 truncate">{exec.email}</span>
                  <div className="flex items-center justify-between mt-1.5 text-xs">
                    <span className="text-gray-400">Orders: {stats.ordersCount}</span>
                    <span className="font-medium text-indigo-600">{fmt(stats.totalSales)}</span>
                  </div>
                </button>
              )
            })}
            {filteredExecutives.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-10">No salespeople found</p>
            )}
          </div>
        </div>

        {/* Right Pane: Salesperson Detail View */}
        <div className="flex-1 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden">
          {selectedExec ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header Details */}
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">{selectedExec.name}</h3>
                  <p className="text-xs text-gray-500">{selectedExec.email} {selectedExec.phone && `• ${selectedExec.phone}`}</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Sales</p>
                    <p className="text-lg font-bold text-indigo-700">{fmt(selectedStats.totalSales)}</p>
                  </div>
                  <div className="text-right border-l border-gray-200 pl-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Orders Count</p>
                    <p className="text-lg font-bold text-gray-900">{selectedStats.ordersCount}</p>
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      {['Order ID', 'Shop Name', 'Date', 'Status', 'Order Amount'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedStats.orders.map((record) => (
                      <tr key={record.order?.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">WS-{record.order?.id}</td>
                        <td className="px-6 py-4 text-gray-700">{record.shop?.shop_name || `Shop #${record.shop?.id}`}</td>
                        <td className="px-6 py-4 text-gray-500">{fmtDate(record.order?.created_at)}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={record.order?.status} />
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{fmt(record.order?.total_amount)}</td>
                      </tr>
                    ))}
                    {selectedStats.orders.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-gray-400 py-12">No orders driven by this salesperson yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a sales executive from the left to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
