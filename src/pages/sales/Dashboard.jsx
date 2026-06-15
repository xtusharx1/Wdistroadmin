import { useState, useEffect } from 'react'
import { getUser } from '../../auth'
import { getSalesAssignments, getOrders } from '../../api'
import StatCard from '../../components/StatCard'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`

export default function SalesDashboard() {
  const me = getUser()
  const [assignedShopsCount, setAssignedShopsCount] = useState(0)
  const [stats, setStats] = useState({
    ordersToday: 0,
    ordersThisMonth: 0,
    deliveredOrders: 0,
    totalSalesValue: 0,
    generatedInvoices: 0,
    totalOrders: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSalesAssignments(), getOrders()])
      .then(([aRes, oRes]) => {
        const allAssignments = aRes.data.data.assignments || []
        const myAssignments = allAssignments.filter((a) => a.sales_exec_id === me?.id)
        
        // Active assigned shops
        const activeAssignments = myAssignments.filter((a) => !a.end_date)
        setAssignedShopsCount(activeAssignments.length)
        
        const shopIds = new Set(myAssignments.map((a) => a.shop_id))
        const allOrders = oRes.data.data.orders || []
        const myOrders = allOrders.filter((o) => shopIds.has(o.shop_id))

        // Timezone calculation (California / America/Los_Angeles)
        const getCADateString = (date) => {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(date))
        }
        
        const getCAMonthYearString = (date) => {
          return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric' }).format(new Date(date))
        }

        const now = new Date()
        const todayStr = getCADateString(now)
        const thisMonthStr = getCAMonthYearString(now)

        let ordersToday = 0
        let ordersThisMonth = 0
        let deliveredOrders = 0
        let totalSalesValue = 0
        let generatedInvoices = 0

        myOrders.forEach((order) => {
          if (!order.created_at) return
          const orderDateStr = getCADateString(order.created_at)
          const orderMonthStr = getCAMonthYearString(order.created_at)

          if (orderDateStr === todayStr) {
            ordersToday++
          }
          if (orderMonthStr === thisMonthStr) {
            ordersThisMonth++
          }

          const isDelivered = order.status === 'delivered' || order.status === 'completed'
          if (isDelivered) {
            deliveredOrders++
            totalSalesValue += Number(order.total_amount || 0)
          }

          if (order.Invoice && order.Invoice.pdf_url) {
            generatedInvoices++
          }
        })

        setStats({
          ordersToday,
          ordersThisMonth,
          deliveredOrders,
          totalSalesValue,
          generatedInvoices,
          totalOrders: myOrders.length,
        })
      })
      .finally(() => setLoading(false))
  }, [me?.id])

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Sales Executive overview for your assigned shops.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Assigned Shops" value={assignedShopsCount} color="indigo" />
        <StatCard label="Orders Today" value={stats.ordersToday} color="blue" />
        <StatCard label="Orders This Month" value={stats.ordersThisMonth} color="blue" />
        <StatCard label="Delivered Orders" value={stats.deliveredOrders} color="green" />
        <StatCard label="Total Sales Value" value={fmt(stats.totalSalesValue)} color="green" sub="Delivered/Completed orders" />
        <StatCard label="Generated Invoices" value={stats.generatedInvoices} color="yellow" />
      </div>
    </div>
  )
}
