import { useState, useEffect } from 'react'
import { getOrders, getShops, getInvoice, regenerateInvoice, addInvoicePayment } from '../../api'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

const paymentBadge = (status) => {
  if (status === 'paid' || status === 'settled') return { label: '✓ Paid', cls: 'bg-green-50 text-green-700 border-green-200' }
  if (status === 'partially_paid') return { label: '~ Partially Paid', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
  return { label: 'Unsettled', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
}

export default function AdminInvoices() {
  const [orders, setOrders] = useState([])
  const [storeMap, setStoreMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [invoiceModal, setInvoiceModal] = useState(null)
  const [invoiceFetching, setInvoiceFetching] = useState(false)
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      const all = oRes.data.data.orders || []
      setOrders(all.filter((o) => o.status === 'dispatched' || o.status === 'delivered' || o.status === 'completed'))
      const stores = sRes.data.data.shops || []
      setStoreMap(stores.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {}))
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
    setInvoiceFetching(true)
    try {
      const res = await regenerateInvoice(invoice.id)
      setInvoiceModal(prev => ({ ...prev, invoice: res.data.data.invoice }))
      alert('Invoice regenerated successfully!')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regenerate invoice.')
    } finally {
      setInvoiceFetching(false)
    }
  }

  const handleAddPayment = async (invoiceId, formData) => {
    setSettling(true)
    try {
      const res = await addInvoicePayment(invoiceId, formData)
      setInvoiceModal(prev => ({ ...prev, invoice: res.data.data.invoice }))
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record payment.')
    } finally {
      setSettling(false)
    }
  }

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Invoices</h2>
      <p className="text-sm text-gray-500 mb-4">
        Invoices are auto-generated when an order is marked as dispatched, delivered, or completed.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Action'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
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
                <td className="px-4 py-3 text-gray-700">{storeMap[o.shop_id] || `Store #${o.shop_id}`}</td>
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
        </div>
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
            storeMap={storeMap}
            onRegenerate={handleInvoiceRegeneration}
            regenerating={invoiceFetching}
            onAddPayment={handleAddPayment}
            settling={settling}
          />
        )}
      </Modal>
    </div>
  )
}

function InvoiceView({ order, invoice, storeMap, onRegenerate, regenerating, onAddPayment, settling }) {
  if (!invoice) {
    return <p className="text-gray-500 text-sm">Invoice not found for this order.</p>
  }

  const items = order.OrderItems || []
  let subtotal = 0
  let totalDiscount = 0

  const processedItems = items.map((item) => {
    const qty = item.approved_qty ?? item.requested_qty
    const originalPrice = Number(item.price || 0)
    const customPrice = item.custom_price !== null && item.custom_price !== undefined ? Number(item.custom_price) : originalPrice
    const discount = originalPrice - customPrice
    const total = customPrice * qty

    subtotal += originalPrice * qty
    totalDiscount += discount * qty

    return { id: item.id, name: item.Product?.name || `Product #${item.product_id}`, sku: item.Product?.sku || '—', qty, originalPrice, discount, finalPrice: customPrice, total }
  })

  const status = invoice.payment_status
  const isPaid = status === 'paid' || status === 'settled'
  const badge = paymentBadge(status)
  const payments = invoice.PaymentHistory || []
  const totalPaid = Number(invoice.total_paid_amount) || 0
  const remaining = Number(invoice.remaining_balance) ?? (invoice.final_amount - totalPaid)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice #{invoice.id}</p>
          <p className="text-sm text-gray-500 mt-0.5">Generated: {new Date(invoice.generated_at).toLocaleString('en-US')}</p>
          <span className={`inline-flex items-center mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium border ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {invoice.pdf_url && (
            <a href={invoice.pdf_url} target="_blank" rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors inline-flex items-center">
              Open PDF
            </a>
          )}
          <button onClick={() => onRegenerate(invoice)} disabled={regenerating}
            className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors">
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <button onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
            Print
          </button>
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 p-4 bg-gray-50 rounded-lg text-sm">
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
          <p className="mt-0.5">{new Date(order.created_at).toLocaleDateString('en-US')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
          <p className="mt-0.5 capitalize">{order.status}</p>
        </div>
      </div>

      {/* Items */}
      <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden min-w-[520px]">
        <thead className="bg-gray-50">
          <tr>
            {['Product Name', 'SKU ID', 'Qty', 'Original Price', 'Discount', 'Final Price', 'Total'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
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
              <td className="px-3 py-2.5 text-green-600">{item.discount > 0 ? `-${fmt(item.discount)}` : '—'}</td>
              <td className="px-3 py-2.5">{fmt(item.finalPrice)}</td>
              <td className="px-3 py-2.5 font-medium">{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end p-4 bg-gray-50 rounded-lg mb-4">
        <div className="text-right space-y-1 text-sm">
          <p className="text-gray-500">Subtotal: <span className="font-semibold text-gray-900">{fmt(subtotal)}</span></p>
          <p className="text-gray-500">Total Discount: <span className="font-semibold text-green-600">-{fmt(totalDiscount)}</span></p>
          <div className="border-t border-gray-200 my-2 pt-2">
            <p className="text-lg font-bold text-indigo-700">Final Payable: <span className="text-2xl ml-1">{fmt(invoice.final_amount)}</span></p>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="p-4 border border-gray-200 rounded-lg mb-4 bg-gray-50">
        <h5 className="text-sm font-semibold text-gray-900 mb-3">Payment Summary</h5>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="text-center p-2.5 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-400 mb-1">Invoice Total</p>
            <p className="font-bold text-gray-900">{fmt(invoice.final_amount)}</p>
          </div>
          <div className="text-center p-2.5 bg-white rounded-lg border border-green-200">
            <p className="text-xs text-gray-400 mb-1">Total Paid</p>
            <p className="font-bold text-green-700">{fmt(totalPaid)}</p>
          </div>
          <div className={`text-center p-2.5 bg-white rounded-lg border ${isPaid ? 'border-green-200' : 'border-orange-200'}`}>
            <p className="text-xs text-gray-400 mb-1">Balance Due</p>
            <p className={`font-bold ${isPaid ? 'text-green-700' : 'text-orange-600'}`}>{fmt(remaining)}</p>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-gray-900 mb-2">Payment History</h5>
          <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Date & Time', 'Method', 'Amount', 'Ref No', 'Verified By', 'Remarks'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-600">{fmtTime(p.verified_at)}</td>
                    <td className="px-3 py-2.5 font-medium">{p.payment_method === 'MO' ? 'Money Order' : p.payment_method}</td>
                    <td className="px-3 py-2.5 font-semibold text-green-700">{fmt(p.payment_amount)}</td>
                    <td className="px-3 py-2.5 font-mono text-gray-500">{p.payment_reference_no || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{p.VerifiedBy?.name || `User #${p.verified_by_user_id}` || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-xs truncate">{p.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Payment Form */}
      {!isPaid && (
        <PaymentForm
          invoiceId={invoice.id}
          invoiceTotal={invoice.final_amount}
          remaining={remaining}
          onAddPayment={onAddPayment}
          settling={settling}
        />
      )}
    </div>
  )
}

function PaymentForm({ invoiceId, invoiceTotal, remaining, onAddPayment, settling }) {
  const [method, setMethod] = useState('')
  const [amount, setAmount] = useState('')
  const [refNo, setRefNo] = useState('')
  const [remarks, setRemarks] = useState('')

  const handleSubmit = () => {
    if (!method) { alert('Please select a payment method.'); return }
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) { alert('Please enter a valid payment amount.'); return }
    if (parsed > remaining + 0.005) {
      alert(`Payment amount cannot exceed the remaining balance (${fmt(remaining)}).`)
      return
    }
    onAddPayment(invoiceId, {
      payment_method: method,
      payment_amount: parsed,
      ...(refNo && { payment_reference_no: refNo }),
      ...(remarks && { remarks }),
    })
  }

  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h5 className="text-sm font-semibold text-gray-900 mb-3">Record Payment</h5>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Payment Method <span className="text-red-500">*</span></label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">Select method…</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Check">Check</option>
              <option value="MO">Money Order (MO)</option>
              <option value="Adjusted">Adjusted</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Payment Amount <span className="text-red-500">*</span></label>
            <input type="number" step="0.01" min="0.01" max={remaining}
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max ${fmt(remaining)}`}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Payment Reference No</label>
          <input type="text" value={refNo} onChange={(e) => setRefNo(e.target.value)}
            placeholder="e.g. CHK-12345, TXN-98765"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Remarks</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
            placeholder="Any notes about this payment…"
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
        </div>
        <button onClick={handleSubmit} disabled={settling || !method || !amount}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 text-sm rounded-md transition-colors">
          {settling ? 'Saving…' : 'Record Payment'}
        </button>
      </div>
    </div>
  )
}
