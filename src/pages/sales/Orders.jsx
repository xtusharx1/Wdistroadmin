import { useState, useEffect } from 'react'
import { getUser } from '../../auth'
import { getSalesAssignments, getOrders, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, processOrder } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

const FILTERS = ['All', 'pending', 'approved', 'dispatched', 'delivered']

export default function SalesOrders() {
  const me = getUser()
  const [orders, setOrders] = useState([])
  const [storeMap, setStoreMap] = useState({})
  const [assignedStoreIds, setAssignedStoreIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  
  // Modals state
  const [detail, setDetail] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  
  const [processModal, setProcessModal] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(null)

  const fetchData = () => {
    Promise.all([getSalesAssignments(), getOrders()]).then(([aRes, oRes]) => {
      const allAssignments = aRes.data.data.assignments || []
      const myAssignments = allAssignments.filter((a) => a.sales_exec_id === me?.id)
      const storeIds = new Set(myAssignments.map((a) => a.shop_id))
      setAssignedStoreIds(storeIds)

      const storeNameMap = myAssignments.reduce((m, a) => {
        if (a.Shop) m[a.shop_id] = a.Shop.shop_name
        return m
      }, {})
      setStoreMap(storeNameMap)

      const allOrders = oRes.data.data.orders || []
      setOrders(allOrders.filter((o) => storeIds.has(o.shop_id)))
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [me?.id])

  useEffect(() => {
    if (detail) {
      setLoadingInvoice(true)
      getInvoice(detail.id)
        .then((res) => setInvoice(res.data.data.invoice))
        .catch(() => setInvoice(null))
        .finally(() => setLoadingInvoice(false))
    } else {
      setInvoice(null)
    }
  }, [detail])

  const handleInvoiceGeneration = async () => {
    setGeneratingInvoice(true)
    try {
      const res = await generateInvoice(detail.id)
      setInvoice(res.data.data.invoice)
      alert('Invoice generated successfully!')
      fetchData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate invoice.')
    } finally {
      setGeneratingInvoice(false)
    }
  }

  const handleInvoiceRegeneration = async () => {
    setGeneratingInvoice(true)
    try {
      const res = await regenerateInvoice(invoice.id)
      setInvoice(res.data.data.invoice)
      alert('Invoice regenerated successfully!')
      fetchData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to regenerate invoice.')
    } finally {
      setGeneratingInvoice(false)
    }
  }

  const doStatusUpdate = async (order, status) => {
    if (!confirm(`Update order WS-${order.id} to "${status}"?`)) return
    setUpdatingStatus(order.id)
    try {
      await updateOrderStatus(order.id, status)
      alert(`Order status updated to ${status}.`)
      setDetail(prev => prev && prev.id === order.id ? { ...prev, status } : prev)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed.')
    } finally {
      setUpdatingStatus(null)
    }
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
    setUpdatingStatus('process')
    try {
      await processOrder(
        processModal.order.id,
        processModal.items.map(({ id, approved_qty, custom_price }) => ({
          id,
          approved_qty,
          custom_price: custom_price !== '' && !isNaN(parseFloat(custom_price)) ? parseFloat(custom_price) : null
        }))
      )
      alert('Order approved and processed successfully.')
      setProcessModal(null)
      setDetail(null)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process order.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const visible =
    filter === 'All' ? orders : orders.filter((o) => o.status === filter)

  if (loading && orders.length === 0) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  if (assignedStoreIds.size === 0) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders</h2>
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">No stores assigned to you yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            From your {assignedStoreIds.size} assigned store{assignedStoreIds.size !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

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
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Detail'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">WS-{o.id}</td>
                <td className="px-4 py-3 text-gray-700">
                  {storeMap[o.shop_id] || `Store #${o.shop_id}`}
                </td>
                <td className="px-4 py-3 text-gray-500">{o.OrderItems?.length ?? 0}</td>
                <td className="px-4 py-3 font-medium">{fmt(o.total_amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(o.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDetail(o)}
                    className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 transition-colors"
                  >
                    View & Manage
                  </button>
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
                <p className="text-xs text-gray-400 uppercase tracking-wide">Store</p>
                <p className="font-medium mt-0.5">{storeMap[detail.shop_id] || `Store #${detail.shop_id}`}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
                <div className="mt-0.5"><StatusBadge status={detail.status} /></div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Placed</p>
                <p className="mt-0.5">{fmtTime(detail.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
                <p className="font-bold text-indigo-700 mt-0.5">{fmt(detail.total_amount)}</p>
              </div>
              {detail.approved_at && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Approved</p>
                  <p className="mt-0.5">{fmtTime(detail.approved_at)}</p>
                </div>
              )}
              {detail.dispatched_at && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Dispatched</p>
                  <p className="mt-0.5">{fmtTime(detail.dispatched_at)}</p>
                </div>
              )}
              {detail.delivered_at && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Delivered</p>
                  <p className="mt-0.5">{fmtTime(detail.delivered_at)}</p>
                </div>
              )}
            </div>

            {/* Quick Status Action Buttons */}
            <div className="flex gap-2 mb-5">
              {detail.status === 'pending' && (
                <button
                  onClick={() => openProcess(detail)}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  Process & Approve Order
                </button>
              )}
              {detail.status === 'approved' && (
                <button
                  onClick={() => doStatusUpdate(detail, 'dispatched')}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  Mark Dispatched
                </button>
              )}
              {detail.status === 'dispatched' && (
                <button
                  onClick={() => doStatusUpdate(detail, 'delivered')}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                >
                  Mark Delivered
                </button>
              )}
            </div>

            {/* Invoice Section */}
            {(detail.status === 'dispatched' || detail.status === 'delivered' || detail.status === 'completed') && (
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
                        onClick={handleInvoiceRegeneration}
                        disabled={generatingInvoice}
                        className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        {generatingInvoice ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleInvoiceGeneration}
                      disabled={generatingInvoice}
                      className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors"
                    >
                      {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Price', 'Requested', 'Approved', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
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
              <span className="text-lg font-bold text-indigo-700">
                {fmt(
                  processModal.items.reduce((s, i) => {
                    const price = i.custom_price !== '' && !isNaN(parseFloat(i.custom_price)) ? parseFloat(i.custom_price) : i.price;
                    return s + price * i.approved_qty;
                  }, 0)
                )}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={submitProcess}
                disabled={updatingStatus === 'process'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 text-sm rounded-md transition-colors"
              >
                {updatingStatus === 'process' ? 'Processing…' : 'Approve & Process Order'}
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
