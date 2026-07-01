import { useState, useEffect, useCallback } from 'react'
import { getOrders, processOrder, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, getShops, editOrder, getProducts } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')

const FILTERS = ['All', 'pending', 'approved', 'dispatched', 'delivered']
const EDITABLE_STATUSES = ['pending', 'approved', 'processed']

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

  // Edit Order modal state
  const [editModal, setEditModal] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addResults, setAddResults] = useState([])
  const [addLoading, setAddLoading] = useState(false)
  const [addSelected, setAddSelected] = useState(null)
  const [addQty, setAddQty] = useState(1)
  const [addPrice, setAddPrice] = useState('')

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

  // Product search for "Add Product" panel in edit modal
  useEffect(() => {
    if (!editModal || addSearch.trim().length < 2) {
      setAddResults([])
      return
    }
    const timer = setTimeout(async () => {
      setAddLoading(true)
      try {
        const res = await getProducts({ search: addSearch.trim(), limit: 8 })
        const products = res.data.data.products || []
        const draftIds = new Set((editModal.items || []).map(i => i.product_id))
        setAddResults(products.filter(p => !draftIds.has(p.id)))
      } catch {
        setAddResults([])
      } finally {
        setAddLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [addSearch, editModal?.items])

  const handleInvoiceGeneration = async () => {
    setGenerating(true)
    try {
      const res = await generateInvoice(detailModal.id)
      setInvoice(res.data.data.invoice)
      notify('Invoice generated successfully!')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to generate invoice.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleInvoiceRegeneration = async () => {
    setGenerating(true)
    try {
      const res = await regenerateInvoice(invoice.id)
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
        custom_price: item.custom_price || '',
        requested_qty: item.requested_qty,
        approved_qty: item.requested_qty,
      })),
    })
  }

  // ── Edit Order ─────────────────────────────────────────────────────────────

  const openEdit = (order) => {
    setEditModal({
      order,
      items: (order.OrderItems || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.Product?.name || `Product #${item.product_id}`,
        product_sku: item.Product?.sku_id || '',
        product_price: item.Product?.price ?? item.price,
        product_stock: item.Product?.stock_quantity ?? 0,
        quantity: order.status === 'pending' ? item.requested_qty : (item.approved_qty || item.requested_qty),
        custom_price: item.custom_price != null ? String(item.custom_price) : ''
      }))
    })
    setAddSearch('')
    setAddResults([])
    setAddSelected(null)
    setAddQty(1)
    setAddPrice('')
  }

  const closeEdit = () => {
    setEditModal(null)
    setAddSearch('')
    setAddResults([])
    setAddSelected(null)
    setAddQty(1)
    setAddPrice('')
  }

  const updateEditQty = (product_id, qty) => {
    setEditModal(prev => ({
      ...prev,
      items: prev.items.map(i =>
        i.product_id === product_id ? { ...i, quantity: Math.max(1, Number(qty) || 1) } : i
      )
    }))
  }

  const updateEditPrice = (product_id, price) => {
    setEditModal(prev => ({
      ...prev,
      items: prev.items.map(i =>
        i.product_id === product_id ? { ...i, custom_price: price } : i
      )
    }))
  }

  const removeEditItem = (product_id) => {
    setEditModal(prev => ({
      ...prev,
      items: prev.items.filter(i => i.product_id !== product_id)
    }))
  }

  const selectAddProduct = (product) => {
    setAddSelected(product)
    setAddSearch(product.name)
    setAddResults([])
    setAddQty(1)
    setAddPrice('')
  }

  const addProductToEdit = () => {
    if (!addSelected) return
    if (editModal.items.find(i => i.product_id === addSelected.id)) {
      notify('Product is already in the order. Update quantity in its existing row.', 'error')
      return
    }
    const qty = Math.max(1, parseInt(addQty) || 1)
    setEditModal(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: addSelected.id,
        product_name: addSelected.name,
        product_sku: addSelected.sku_id || '',
        product_price: addSelected.price,
        product_stock: addSelected.stock_quantity ?? 0,
        quantity: qty,
        custom_price: addPrice
      }]
    }))
    setAddSelected(null)
    setAddSearch('')
    setAddResults([])
    setAddQty(1)
    setAddPrice('')
  }

  const submitEdit = async () => {
    if (!editModal || editModal.items.length === 0) {
      notify('Order must have at least one product.', 'error')
      return
    }
    setEditSaving(true)
    try {
      await editOrder(
        editModal.order.id,
        editModal.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          custom_price: item.custom_price !== '' && !isNaN(parseFloat(item.custom_price))
            ? parseFloat(item.custom_price)
            : null
        }))
      )
      notify('Order updated successfully.')
      closeEdit()
      refresh()
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update order.', 'error')
    } finally {
      setEditSaving(false)
    }
  }

  const editDraftTotal = (editModal?.items || []).reduce((sum, item) => {
    const price = item.custom_price !== '' && !isNaN(parseFloat(item.custom_price))
      ? parseFloat(item.custom_price)
      : item.product_price
    return sum + price * item.quantity
  }, 0)

  // ── Process modal handlers ─────────────────────────────────────────────────

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
    setActing('process')
    try {
      await processOrder(
        processModal.order.id,
        processModal.items.map(({ id, approved_qty, custom_price }) => ({
          id,
          approved_qty,
          custom_price: custom_price !== '' && !isNaN(parseFloat(custom_price)) ? parseFloat(custom_price) : null
        }))
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
    (s, item) => {
      const price = item.custom_price !== '' && !isNaN(parseFloat(item.custom_price)) ? parseFloat(item.custom_price) : item.price;
      return s + price * item.approved_qty;
    },
    0
  ) ?? 0

  const storeMap = shops.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {})

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
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
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
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
                <td className="px-4 py-3 text-gray-500">{storeMap[o.shop_id] || `Store #${o.shop_id}`}</td>
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
                    {EDITABLE_STATUSES.includes(o.status) && (
                      <button
                        onClick={() => openEdit(o)}
                        className="text-xs px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {(o.status === 'approved' || o.status === 'dispatched' || o.status === 'delivered') && (
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
        </div>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No orders in this category</p>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={`Order WS-${detailModal?.id}`} size="lg">
        {detailModal && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
              {[
                ['Store', storeMap[detailModal.shop_id] || `Store #${detailModal.shop_id}`],
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
            <div className="mt-4 mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              <div className="flex gap-2 flex-wrap">
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

            <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden min-w-[400px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Price', 'Requested', 'Approved', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(detailModal.OrderItems || []).map((item) => {
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

            <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden min-w-[520px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Unit Price', 'Custom Price', 'Requested', 'Approve Qty', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
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
                        className={`w-20 border rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          item.approved_qty < item.requested_qty
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
            </div>

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

      {/* Edit Order Modal */}
      <Modal
        open={!!editModal}
        onClose={closeEdit}
        title={`Edit Order WS-${editModal?.order.id}`}
        size="xl"
      >
        {editModal && (
          <div>
            {/* Order context bar */}
            <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-gray-100 text-sm">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide mr-1.5">Store</span>
                <span className="font-medium">{storeMap[editModal.order.shop_id] || `Store #${editModal.order.shop_id}`}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide mr-1.5">Status</span>
                <StatusBadge status={editModal.order.status} />
              </div>
              <div className="ml-auto text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                Changes are held in draft — nothing saves until you click <strong>Save Changes</strong>
              </div>
            </div>

            {/* Current items table */}
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Order Items</h3>
            {editModal.items.length === 0 ? (
              <p className="text-sm text-gray-400 italic mb-4">No items. Add at least one product below.</p>
            ) : (
              <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden min-w-[500px]">
                <thead className="bg-gray-50">
                  <tr>
                    {['Product', 'List Price', 'Selling Price', 'Qty', 'Subtotal', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editModal.items.map((item) => {
                    const effectivePrice = item.custom_price !== '' && !isNaN(parseFloat(item.custom_price))
                      ? parseFloat(item.custom_price)
                      : item.product_price
                    return (
                      <tr key={item.product_id}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{item.product_name}</p>
                          {item.product_sku && <p className="text-xs text-gray-400">{item.product_sku}</p>}
                          {editModal.order.status !== 'pending' && (
                            <p className="text-xs text-gray-400">Stock: {item.product_stock}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">{fmt(item.product_price)}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.custom_price}
                            placeholder={`${item.product_price}`}
                            onChange={(e) => updateEditPrice(item.product_id, e.target.value)}
                            className="w-28 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateEditQty(item.product_id, e.target.value)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium">{fmt(effectivePrice * item.quantity)}</td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => removeEditItem(item.product_id)}
                            className="text-red-400 hover:text-red-600 transition-colors text-lg leading-none"
                            title="Remove product"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            )}

            {/* Add Product panel */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-5 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Product</h3>
              <div className="flex gap-2 flex-wrap items-start">
                <div className="flex-1 min-w-48 relative">
                  <input
                    type="text"
                    value={addSearch}
                    onChange={(e) => { setAddSearch(e.target.value); setAddSelected(null) }}
                    placeholder="Search by product name…"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {(addLoading || addResults.length > 0) && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {addLoading && (
                        <p className="text-xs text-gray-400 px-3 py-2">Searching…</p>
                      )}
                      {!addLoading && addResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => selectAddProduct(p)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                        >
                          <span className="font-medium text-gray-900">{p.name}</span>
                          {p.sku_id && <span className="ml-2 text-xs text-gray-400">{p.sku_id}</span>}
                          <span className="ml-2 text-xs text-indigo-600">{fmt(p.price)}</span>
                          <span className={`ml-2 text-xs ${p.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : 'Out of stock'}
                          </span>
                        </button>
                      ))}
                      {!addLoading && addResults.length === 0 && addSearch.trim().length >= 2 && (
                        <p className="text-xs text-gray-400 px-3 py-2">No products found</p>
                      )}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  placeholder="Qty"
                  className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  placeholder="Price (optional)"
                  className="w-36 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={addProductToEdit}
                  disabled={!addSelected}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  + Add
                </button>
              </div>
              {addSelected && (
                <p className="mt-2 text-xs text-indigo-600">
                  Selected: <strong>{addSelected.name}</strong> — {fmt(addSelected.price)} — {addSelected.stock_quantity} in stock
                </p>
              )}
            </div>

            {/* Draft total + actions */}
            <div className="flex items-center justify-between py-3 border-t border-gray-200 mb-4">
              <div>
                <span className="text-sm text-gray-500">Original Total: </span>
                <span className="text-sm font-medium text-gray-600 line-through">{fmt(editModal.order.total_amount)}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500 mr-2">Draft Total:</span>
                <span className="text-xl font-bold text-amber-700">{fmt(editDraftTotal)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={submitEdit}
                disabled={editSaving || editModal.items.length === 0}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold py-2 text-sm rounded-md transition-colors"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md transition-colors"
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
