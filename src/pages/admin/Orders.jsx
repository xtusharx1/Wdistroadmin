import { useState, useEffect } from 'react'
import { getOrders, getShops, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, processOrder } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

const STATUSES = ['pending', 'approved', 'dispatched', 'delivered']
const FILTERS = ['All', ...STATUSES]

const NEXT_STATUS = {
  pending: ['approved'],
  approved: ['dispatched'],
  dispatched: ['delivered'],
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [storeMap, setStoreMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [detail, setDetail] = useState(null)
  const [updating, setUpdating] = useState(null)

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
      const stores = sRes.data.data.shops || []
      setStoreMap(stores.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {}))
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (detail) {
      setLoadingInvoice(true)
      getInvoice(detail.id)
        .then((res) => {
          setInvoice(res.data.data.invoice)
        })
        .catch(() => {
          setInvoice(null)
        })
        .finally(() => {
          setLoadingInvoice(false)
        })
    }
  }, [detail])

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
      const res = await generateInvoice(detail.id, charges)
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

  const [processModal, setProcessModal] = useState(null)

  const refresh = () => {
    getOrders().then((res) => setOrders(res.data.data.orders || []))
  }

  const openProcess = (order) => {
    setProcessModal({
      order,
      items: (order.OrderItems || []).map((item) => ({
        id: item.id,
        name: item.Product?.name || `Product #${item.product_id}`,
        unit: item.Product?.unit || '',
        price: item.price,
        custom_price: item.custom_price || '',
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

  const updateItemPrice = (itemId, price) => {
    setProcessModal((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? { ...item, custom_price: price }
          : item
      ),
    }))
  }

  const submitProcess = async () => {
    setUpdating('process')
    try {
      await processOrder(
        processModal.order.id,
        processModal.items.map(({ id, approved_qty, custom_price }) => ({
          id,
          approved_qty,
          custom_price: custom_price !== '' && !isNaN(parseFloat(custom_price)) ? parseFloat(custom_price) : null
        }))
      )
      notify('Order approved and processed successfully.')
      setProcessModal(null)
      refresh()
      if (detail?.id === processModal.order.id) {
        setDetail(null) // Close detail modal since status/values changed
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to process order.', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const doStatusUpdate = async (order, status) => {
    if (!confirm(`Update order WS-${order.id} to "${status}"?`)) return
    setUpdating(order.id)
    try {
      await updateOrderStatus(order.id, status)
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      )
      if (detail?.id === order.id) setDetail((d) => ({ ...d, status }))
      notify('Order status updated.')
    } catch (err) {
      notify(err.response?.data?.message || 'Update failed.', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const visible = orders.filter((o) => {
    if (filter !== 'All' && o.status !== filter) return false
    if (search && !String(o.id).includes(search)) return false
    return true
  })

  const approvedTotal = processModal?.items.reduce(
    (s, item) => {
      const price = item.custom_price !== '' && !isNaN(parseFloat(item.custom_price)) ? parseFloat(item.custom_price) : item.price;
      return s + price * item.approved_qty;
    },
    0
  ) ?? 0

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
        <input
          type="text"
          placeholder="Search order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
        />
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-md px-4 py-2.5 text-sm ${msg.type === 'error'
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
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((o, index) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <button
                    onClick={() => setDetail(o)}
                    className="text-indigo-600 hover:underline"
                  >
                    WS-{o.id}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {storeMap[o.shop_id] || `Store #${o.shop_id}`}
                </td>
                <td className="px-4 py-3 text-gray-500">{o.OrderItems?.length ?? 0}</td>
                <td className="px-4 py-3 font-medium">{fmt(o.total_amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(o.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {(NEXT_STATUS[o.status] || []).map((ns) => (
                      <button
                        key={ns}
                        onClick={() => {
                          if (ns === 'approved') {
                            openProcess(o)
                          } else {
                            doStatusUpdate(o, ns)
                          }
                        }}
                        disabled={updating === o.id}
                        className={`text-xs px-2.5 py-1 rounded font-medium disabled:opacity-50 transition-colors ${ns === 'approved' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
                            ns === 'dispatched' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                              'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                      >
                        {ns === 'approved' ? 'Approve' : ns === 'dispatched' ? 'Dispatch' : 'Mark Delivered'}
                      </button>
                    ))}
                    {(o.status === 'dispatched' || o.status === 'delivered') && (
                      <button
                        onClick={() => setDetail(o)}
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
          <p className="text-center text-gray-400 text-sm py-10">No orders found</p>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order WS-${detail?.id}`} size="lg">
        {detail && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Store</p>
                <p className="font-medium">{storeMap[detail.shop_id] || `Store #${detail.shop_id}`}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Status</p>
                <StatusBadge status={detail.status} />
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Placed</p>
                <p>{fmtTime(detail.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Total</p>
                <p className="font-bold text-indigo-700">{fmt(detail.total_amount)}</p>
              </div>
              {detail.approved_at && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Approved</p>
                  <p>{fmtTime(detail.approved_at)}</p>
                </div>
              )}
              {detail.dispatched_at && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Dispatched</p>
                  <p>{fmtTime(detail.dispatched_at)}</p>
                </div>
              )}
              {detail.delivered_at && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Delivered</p>
                  <p>{fmtTime(detail.delivered_at)}</p>
                </div>
              )}
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
                      download={`invoice-${detail.id}.pdf`}
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
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(detail.OrderItems || []).map((item) => {
                  const qty = item.approved_qty ?? item.requested_qty
                  const itemPrice = item.custom_price !== null && item.custom_price !== undefined ? item.custom_price : item.price
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5">{item.Product?.name || `Product #${item.product_id}`}</td>
                      <td className="px-3 py-2.5">
                        {item.custom_price !== null && item.custom_price !== undefined ? (
                          <div>
                            <span className="text-green-600 font-semibold">{fmt(item.custom_price)}</span>
                            <span className="text-xs text-gray-400 line-through ml-1.5">{fmt(item.price)}</span>
                          </div>
                        ) : (
                          fmt(item.price)
                        )}
                      </td>
                      <td className="px-3 py-2.5">{item.requested_qty}</td>
                      <td className="px-3 py-2.5">
                        <span className={item.approved_qty != null && item.approved_qty < item.requested_qty ? 'text-amber-600 font-medium' : ''}>
                          {item.approved_qty ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{fmt(itemPrice * qty)}</td>
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
                  {['Product', 'Unit Price', 'Custom Price', 'Requested', 'Approve Qty', 'Subtotal'].map((h) => (
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
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.custom_price}
                        placeholder="None"
                        onChange={(e) => updateItemPrice(item.id, e.target.value)}
                        className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{item.requested_qty}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        max={item.requested_qty}
                        value={item.approved_qty}
                        onChange={(e) => updateItemQty(item.id, Number(e.target.value))}
                        className={`w-20 border rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${item.approved_qty < item.requested_qty
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-gray-300'
                          }`}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {fmt((item.custom_price !== '' && !isNaN(parseFloat(item.custom_price)) ? parseFloat(item.custom_price) : item.price) * item.approved_qty)}
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
                disabled={updating === 'process'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 text-sm rounded-md transition-colors"
              >
                {updating === 'process' ? 'Processing…' : 'Approve & Process Order'}
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
