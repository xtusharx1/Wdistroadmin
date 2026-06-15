import { useState, useEffect } from 'react'
import { getProducts, getOrders, getShops } from '../../api'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

export default function SellerDashboard() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getProducts({ page: 1, limit: 200 }),
      getOrders(),
      getShops(),
    ]).then(([pRes, oRes, sRes]) => {
      setProducts(pRes.data.data.products || [])
      setOrders(oRes.data.data.orders || [])
      setShops(sRes.data.data.shops || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  const totalProducts = products.length
  const lowStock = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 10).length
  const outOfStock = products.filter((p) => p.stock_quantity === 0).length
  const pendingOrders = orders.filter((o) => o.status === 'pending').length
  const revenue = orders
    .filter((o) => o.status === 'delivered' || o.status === 'completed')
    .reduce((s, o) => s + (o.total_amount || 0), 0)

  const shopMap = shops.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {})

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Products" value={totalProducts} color="indigo" />
        <StatCard label="Low Stock" value={lowStock} color="yellow" sub="Under 10 units" />
        <StatCard label="Out of Stock" value={outOfStock} color="red" />
        <StatCard label="Pending Orders" value={pendingOrders} color="yellow" />
        <StatCard label="Total Orders" value={orders.length} color="indigo" />
        <StatCard label="Revenue (Delivered)" value={fmt(revenue)} color="green" />
      </div>

      {lowStock > 0 && (
        <div className="mb-5 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          ⚠ <strong>{lowStock}</strong> product{lowStock > 1 ? 's are' : ' is'} running low on stock.
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Order ID', 'Shop', 'Items', 'Total', 'Status', 'Date'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.slice(0, 8).map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium">WS-{o.id}</td>
                <td className="px-4 py-2.5 text-gray-500">{shopMap[o.shop_id] || `Shop #${o.shop_id}`}</td>
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
