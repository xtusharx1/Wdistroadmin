import { useState, useEffect } from 'react'
import { getOrders, processOrder, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, getShops } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')

const FILTERS = ['All', 'pending', 'approved', 'dispatched', 'delivered']

export default function SellerOrders() {
  const [orders, setOrders] = useState([])
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [msg, setMsg] = useState(null)
  const [processModal, setProcessModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [acting, setActing] = useState(null)

  const [invoice, setInvoice] = useState(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [generating, setGenerating] = useState(false)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      setOrders(oRes.data.data.orders || [])
      setShops(sRes.data.data.shops || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!detailModal) {
      setInvoice(null)
      return
    }
    setLoadingInvoice(true)
    getInvoice(detailModal.id)
      .then((res) => {
        setInvoice(res.data.data.invoice)
      })
      .catch(() => {
        setInvoice(null)
      })
      .finally(() => setLoadingInvoice(false))
  }, [detailModal])

  const handleInvoiceGeneration = async () => {
    let charges = 0
    const addShipping = window.confirm("Add shipping charges?")
    if (addShipping) {
      const amountPrompt = window.prompt("Enter shipping charges amount ($):", "0.00")
      if (amountPrompt === null) return
      charges = parseFloat(amountPrompt)
      if (isNaN(charges) || charges < 0) {
        alert("Please enter a valid numeric value for shipping charges.")
        return
      }
    }
    
    setGenerating(true)
    try {
      const res = await generateInvoice(detailModal.id, charges)
      setInvoice(res.data.data.invoice)
      notify('Invoice generated successfully!')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to generate invoice.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleInvoiceRegeneration = async () => {
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
    
    setGenerating(true)
    try {
      const res = await regenerateInvoice(invoice.id, charges)
      setInvoice(res.data.data.invoice)
      notify('Invoice regenerated successfully!')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to regenerate invoice.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const refresh = () => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      setOrders(oRes.data.data.orders || [])
      setShops(sRes.data.data.shops || [])
    })
  }

  const openProcess = (order) => {
    setProcessModal({
      order,
      items: (order.OrderItems || []).map((item) => ({
        id: item.id,
        name: item.Product?.name || `Product #${item.product_id}`,
        unit: item.Product?.unit || '',
        price: item.price,
        requested_qty: item.requested_qty,
        approved_qty: item.requested_qty,
      })),
    })
  }

  const updateItemQty = (itemId, qty) => {
    setProcessModal((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? { ...item, approved_qty: Math.max(0, Math.min(qty, item.requested_qty)) }
          : item
      ),
    }))
  }

  const submitProcess = async () => {
    setActing('process')
    try {
      await processOrder(
        processModal.order.id,
        processModal.items.map(({ id, approved_qty }) => ({ id, approved_qty }))
      )
      notify('Order approved and processed.')
      setProcessModal(null)
      refresh()
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to process order.', 'error')
    } finally {
      setActing(null)
    }
  }

  const doStatusUpdate = async (order, status, label) => {
    if (!confirm(`Mark order WS-${order.id} as "${label}"?`)) return
    setActing(order.id)
    try {
      await updateOrderStatus(order.id, status)
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      )
      notify(`Order marked as ${label}.`)
    } catch (err) {
      notify(err.response?.data?.message || 'Update failed.', 'error')
    } finally {
      setActing(null)
    }
  }

  const visible =
    filter === 'All' ? orders : orders.filter((o) => o.status === filter)

  const approvedTotal = processModal?.items.reduce(
    (s, item) => s + item.price * item.approved_qty,
    0
  ) ?? 0

  const shopMap = shops.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {})

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
        <span className="text-sm text-gray-500">
          {orders.filter((o) => o.status === 'pending').length} pending
        </span>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-md px-4 py-2.5 text-sm ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex gap-1 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
            {f === 'pending' && (
              <span className="ml-1">
                ({orders.filter((o) => o.status === 'pending').length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Order ID', 'Shop', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <button
                    className="text-indigo-600 hover:underline"
                    onClick={() => setDetailModal(o)}
                  >
                    WS-{o.id}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500">{shopMap[o.shop_id] || `Shop #${o.shop_id}`}</td>
                <td className="px-4 py-3 text-gray-500">{o.OrderItems?.length ?? 0}</td>
                <td className="px-4 py-3 font-medium">{fmt(o.total_amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(o.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {o.status === 'pending' && (
                      <button
                        onClick={() => openProcess(o)}
                        className="text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {o.status === 'approved' && (
                      <button
                        onClick={() => doStatusUpdate(o, 'dispatched', 'Dispatched')}
                        disabled={acting === o.id}
                        className="text-xs px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        Dispatch
                      </button>
                    )}
                    {o.status === 'dispatched' && (
                      <button
                        onClick={() => doStatusUpdate(o, 'delivered', 'Delivered')}
                        disabled={acting === o.id}
                        className="text-xs px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        Mark Delivered
                      </button>
                    )}
                    {(o.status === 'dispatched' || o.status === 'delivered') && (
                      <button
                        onClick={() => setDetailModal(o)}
                        className="text-xs px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors"
                      >
                        Invoice
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No orders in this category</p>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={`Order WS-${detailModal?.id}`} size="lg">
        {detailModal && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              {[
                ['Shop', shopMap[detailModal.shop_id] || `Shop #${detailModal.shop_id}`],
                ['Status', null],
                ['Placed', fmtDate(detailModal.created_at)],
                ['Total', fmt(detailModal.total_amount)],
                detailModal.approved_at && ['Approved', fmtDate(detailModal.approved_at)],
                detailModal.dispatched_at && ['Dispatched', fmtDate(detailModal.dispatched_at)],
                detailModal.delivered_at && ['Delivered', fmtDate(detailModal.delivered_at)],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                  {label === 'Status' ? (
                    <StatusBadge status={detailModal.status} />
                  ) : (
                    <p className="font-medium mt-0.5">{value}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Invoice Section */}
            <div className="mt-4 mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Invoice Management
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {loadingInvoice ? 'Checking invoice status...' : 
                   invoice ? `Invoice #${invoice.id} generated on ${new Date(invoice.generated_at).toLocaleDateString('en-IN')}` :
                   'No invoice generated for this order yet.'}
                </p>
              </div>
              <div className="flex gap-2">
                {loadingInvoice ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : invoice?.pdf_url ? (
                  <>
                    <a
                      href={invoice.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                    >
                      View Invoice
                    </a>
                    <a
                      href={invoice.pdf_url}
                      download={`invoice-${detailModal.id}.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                    >
                      Download Invoice
                    </a>
                    <button
                      onClick={() => handleInvoiceRegeneration()}
                      disabled={generating}
                      className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
                    >
                      {generating ? 'Regenerating...' : 'Regenerate Invoice'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleInvoiceGeneration()}
                    disabled={generating}
                    className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors"
                  >
                    {generating ? 'Generating...' : 'Generate Invoice'}
                  </button>
                )}
              </div>
            </div>

            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Price', 'Requested', 'Approved', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(detailModal.OrderItems || []).map((item) => {
                  const qty = item.approved_qty ?? item.requested_qty
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5">{item.Product?.name || `Product #${item.product_id}`}</td>
                      <td className="px-3 py-2.5">{fmt(item.price)}</td>
                      <td className="px-3 py-2.5">{item.requested_qty}</td>
                      <td className="px-3 py-2.5">
                        <span className={item.approved_qty != null && item.approved_qty < item.requested_qty ? 'text-amber-600 font-medium' : ''}>
                          {item.approved_qty ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{fmt(item.price * qty)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Process Order Modal */}
      <Modal
        open={!!processModal}
        onClose={() => setProcessModal(null)}
        title={`Process Order WS-${processModal?.order.id}`}
        size="lg"
      >
        {processModal && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Review requested quantities and set approved amounts. Reducing a quantity will
              recalculate the order total.
            </p>

            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden mb-4">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Unit Price', 'Requested', 'Approve Qty', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processModal.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5 font-medium">
                      {item.name}
                      {item.unit && <span className="ml-1 text-xs text-gray-400">/ {item.unit}</span>}
                    </td>
                    <td className="px-3 py-2.5">{fmt(item.price)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{item.requested_qty}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        max={item.requested_qty}
                        value={item.approved_qty}
                        onChange={(e) => updateItemQty(item.id, Number(e.target.value))}
                        className={`w-20 border rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          item.approved_qty < item.requested_qty
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-gray-300'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {fmt(item.price * item.approved_qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-gray-500">Approved Total</span>
              <span className="text-lg font-bold text-indigo-700">{fmt(approvedTotal)}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={submitProcess}
                disabled={acting === 'process'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 text-sm rounded-md transition-colors"
              >
                {acting === 'process' ? 'Processing…' : 'Approve & Process Order'}
              </button>
              <button
                onClick={() => setProcessModal(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
