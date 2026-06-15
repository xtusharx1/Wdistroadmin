import { useState, useEffect } from 'react'
import { getOrders, getShops, getInvoice, regenerateInvoice } from '../../api'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

export default function AdminInvoices() {
  const [orders, setOrders] = useState([])
  const [shopMap, setShopMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [invoiceModal, setInvoiceModal] = useState(null)
  const [invoiceFetching, setInvoiceFetching] = useState(false)

  useEffect(() => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      const all = oRes.data.data.orders || []
      setOrders(all.filter((o) => o.status === 'dispatched' || o.status === 'delivered' || o.status === 'completed'))
      const shops = sRes.data.data.shops || []
      setShopMap(shops.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {}))
    }).finally(() => setLoading(false))
  }, [])

  const openInvoice = async (order) => {
    setInvoiceFetching(true)
    try {
      const res = await getInvoice(order.id)
      setInvoiceModal({ order, invoice: res.data.data.invoice })
    } catch {
      setInvoiceModal({ order, invoice: null })
    } finally {
      setInvoiceFetching(false)
    }
  }

  const handleInvoiceRegeneration = async (invoice) => {
    let charges = invoice?.shipping_charge || 0
    const addShipping = window.confirm("Do you want to add or update shipping charges?")
    if (addShipping) {
      const amountPrompt = window.prompt("Enter shipping charges amount ($):", charges.toFixed(2))
      if (amountPrompt === null) return
      charges = parseFloat(amountPrompt)
      if (isNaN(charges) || charges < 0) {
        alert("Please enter a valid numeric value for shipping charges.")
        return
      }
    }
    
    setInvoiceFetching(true)
    try {
      const res = await regenerateInvoice(invoice.id, charges)
      setInvoiceModal(prev => ({ ...prev, invoice: res.data.data.invoice }))
      alert('Invoice regenerated successfully!')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regenerate invoice.')
    } finally {
      setInvoiceFetching(false)
    }
  }

  const handlePrint = () => window.print()

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Invoices</h2>
      <p className="text-sm text-gray-500 mb-4">
        Invoices are auto-generated when an order is marked as dispatched, delivered, or completed.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Order ID', 'Shop', 'Items', 'Total', 'Status', 'Date', 'Action'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o, index) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">WS-{o.id}</td>
                <td className="px-4 py-3 text-gray-700">{shopMap[o.shop_id] || `Shop #${o.shop_id}`}</td>
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
                    disabled={invoiceFetching}
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

      <Modal
        open={!!invoiceModal}
        onClose={() => setInvoiceModal(null)}
        title="Invoice"
        size="lg"
      >
        {invoiceModal && (
          <InvoiceView
            order={invoiceModal.order}
            invoice={invoiceModal.invoice}
            shopMap={shopMap}
            onPrint={handlePrint}
            onRegenerate={handleInvoiceRegeneration}
            regenerating={invoiceFetching}
          />
        )}
      </Modal>
    </div>
  )
}

function InvoiceView({ order, invoice, shopMap, onPrint, onRegenerate, regenerating }) {
  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`

  if (!invoice) {
    return <p className="text-gray-500 text-sm">Invoice not found for this order.</p>
  }

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
            onClick={onPrint}
            className="text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-gray-50 rounded-lg text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Order</p>
          <p className="font-medium mt-0.5">WS-{order.id}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Shop</p>
          <p className="font-medium mt-0.5">{shopMap[order.shop_id] || `Shop #${order.shop_id}`}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Order Date</p>
          <p className="mt-0.5">{new Date(order.created_at).toLocaleDateString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
          <p className="mt-0.5 capitalize">{order.status}</p>
        </div>
      </div>

      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden mb-4">
        <thead className="bg-gray-50">
          <tr>
            {['Product', 'Qty', 'Unit Price', 'Total'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(order.OrderItems || []).map((item) => {
            const qty = item.approved_qty ?? item.requested_qty
            return (
              <tr key={item.id}>
                <td className="px-3 py-2.5">{item.Product?.name || `Product #${item.product_id}`}</td>
                <td className="px-3 py-2.5">{qty} {item.Product?.unit || ''}</td>
                <td className="px-3 py-2.5">{fmt(item.price)}</td>
                <td className="px-3 py-2.5 font-medium">{fmt(item.price * qty)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex justify-end mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-right space-y-1 text-sm">
          <p className="text-gray-500">
            Subtotal: <span className="font-semibold text-gray-900">{fmt(order.total_amount)}</span>
          </p>
          <p className="text-gray-500">
            Shipping: <span className="font-semibold text-gray-900">{fmt(invoice.shipping_charge || 0)}</span>
          </p>
          <div className="border-t border-gray-200 my-2 pt-2">
            <p className="text-lg font-bold text-indigo-700">
              Grand Total: <span className="text-2xl ml-1">{fmt(invoice.final_amount)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
