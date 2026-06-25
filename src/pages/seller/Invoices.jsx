import { useState, useEffect } from 'react'
import { getOrders, getInvoice, getShops, regenerateInvoice } from '../../api'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')

export default function SellerInvoices() {
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [invoiceModal, setInvoiceModal] = useState(null)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      const all = oRes.data.data.orders || []
      setOrders(all.filter((o) => o.status === 'dispatched' || o.status === 'delivered' || o.status === 'completed'))
      setStores(sRes.data.data.shops || [])
    }).finally(() => setLoading(false))
  }, [])

  const openInvoice = async (order) => {
    setFetching(true)
    try {
      const res = await getInvoice(order.id)
      setInvoiceModal({ order, invoice: res.data.data.invoice })
    } catch {
      setInvoiceModal({ order, invoice: null })
    } finally {
      setFetching(false)
    }
  }

  const handleInvoiceRegeneration = async (invoice) => {
    setFetching(true)
    try {
      const res = await regenerateInvoice(invoice.id)
      setInvoiceModal(prev => ({ ...prev, invoice: res.data.data.invoice }))
      alert('Invoice regenerated successfully!')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regenerate invoice.')
    } finally {
      setFetching(false)
    }
  }

  const storeMap = stores.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {})

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Invoice History</h2>
      <p className="text-sm text-gray-500 mb-4">
        Invoices are automatically generated when an order is dispatched, delivered, or completed.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Order ID', 'Store', 'Items', 'Total', 'Status', 'Delivery Date', 'Invoice'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">WS-{o.id}</td>
                <td className="px-4 py-3 text-gray-500">{storeMap[o.shop_id] || `Store #${o.shop_id}`}</td>
                <td className="px-4 py-3 text-gray-500">{o.OrderItems?.length ?? 0}</td>
                <td className="px-4 py-3 font-medium">{fmt(o.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(o.delivered_at || o.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openInvoice(o)}
                    disabled={fetching}
                    className="text-xs px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    View Invoice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No invoices yet</p>
        )}
      </div>

      <Modal open={!!invoiceModal} onClose={() => setInvoiceModal(null)} title="Invoice" size="lg">
        {invoiceModal && (
          <InvoiceView
            order={invoiceModal.order}
            invoice={invoiceModal.invoice}
            storeMap={storeMap}
            onRegenerate={handleInvoiceRegeneration}
            regenerating={fetching}
          />
        )}
      </Modal>
    </div>
  )
}

function InvoiceView({ order, invoice, storeMap, onRegenerate, regenerating }) {
  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`

  if (!invoice) {
    return <p className="text-gray-500 text-sm py-4">Invoice not found for this order.</p>
  }

  // Calculate invoice discount details
  const items = order.OrderItems || []
  let subtotal = 0
  let totalDiscount = 0

  const processedItems = items.map((item) => {
    const qty = item.approved_qty ?? item.requested_qty
    const originalPrice = Number(item.price || 0)
    const customPrice = item.custom_price !== null && item.custom_price !== undefined ? Number(item.custom_price) : originalPrice
    const discount = originalPrice - customPrice
    const finalPrice = customPrice
    const total = finalPrice * qty

    subtotal += originalPrice * qty
    totalDiscount += discount * qty

    return {
      id: item.id,
      name: item.Product?.name || `Product #${item.product_id}`,
      sku: item.Product?.sku || '—',
      qty,
      originalPrice,
      discount,
      finalPrice,
      total
    }
  })

  const finalPayable = subtotal - totalDiscount

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice #{invoice.id}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Generated: {new Date(invoice.generated_at).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.pdf_url && (
            <a
              href={invoice.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors inline-flex items-center"
            >
              Open PDF
            </a>
          )}
          <button
            onClick={() => onRegenerate(invoice)}
            disabled={regenerating}
            className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {regenerating ? 'Regenerating...' : 'Regenerate Invoice'}
          </button>
          <button
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg mb-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Order</p>
          <p className="font-medium mt-0.5">WS-{order.id}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Store</p>
          <p className="font-medium mt-0.5">{storeMap[order.shop_id] || `Store #${order.shop_id}`}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Order Date</p>
          <p className="mt-0.5">{fmtDate(order.created_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Delivered</p>
          <p className="mt-0.5">{fmtDate(order.delivered_at)}</p>
        </div>
      </div>

      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mb-4">
        <thead className="bg-gray-50">
          <tr>
            {['Product Name', 'SKU ID', 'Qty', 'Original Price', 'Discount', 'Final Price', 'Total'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {processedItems.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-2.5 font-medium text-gray-900">{item.name}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{item.sku}</td>
              <td className="px-3 py-2.5">{item.qty}</td>
              <td className="px-3 py-2.5">{fmt(item.originalPrice)}</td>
              <td className="px-3 py-2.5 text-green-600">
                {item.discount > 0 ? `-${fmt(item.discount)}` : '—'}
              </td>
              <td className="px-3 py-2.5">{fmt(item.finalPrice)}</td>
              <td className="px-3 py-2.5 font-medium">{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-right space-y-1 text-sm">
          <p className="text-gray-500">
            Subtotal: <span className="font-semibold text-gray-900">{fmt(subtotal)}</span>
          </p>
          <p className="text-gray-500">
            Total Discount: <span className="font-semibold text-green-600">-{fmt(totalDiscount)}</span>
          </p>

          <div className="border-t border-gray-200 my-2 pt-2">
            <p className="text-lg font-bold text-indigo-700">
              Final Payable: <span className="text-2xl ml-1">{fmt(finalPayable)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
