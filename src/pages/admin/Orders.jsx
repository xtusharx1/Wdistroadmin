import { useState, useEffect, useRef } from 'react'
import { getOrders, getShops, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, processOrder, addInvoicePayment, editOrder, getProducts } from '../../api'
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

const EDITABLE_STATUSES = ['pending', 'approved']

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
  const [settling, setSettling] = useState(false)
  const [showSettleForm, setShowSettleForm] = useState(false)
  const [settleMethod, setSettleMethod] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleRefNo, setSettleRefNo] = useState('')
  const [settleRemarks, setSettleRemarks] = useState('')
  const [payments, setPayments] = useState([])

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
    setShowSettleForm(false)
    setSettleMethod('')
    setSettleAmount('')
    setSettleRefNo('')
    setSettleRemarks('')
    setPayments([])
    if (detail) {
      setLoadingInvoice(true)
      getInvoice(detail.id)
        .then((res) => {
          const inv = res.data.data.invoice
          setInvoice(inv)
          setPayments(inv?.PaymentHistory || [])
        })
        .catch(() => {
          setInvoice(null)
          setPayments([])
        })
        .finally(() => {
          setLoadingInvoice(false)
        })
    }
  }, [detail])

  const handleInvoiceGeneration = async () => {
    setGenerating(true)
    try {
      const res = await generateInvoice(detail.id)
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

  const handleSettle = async () => {
    if (!settleMethod) { notify('Please select a payment method.', 'error'); return }
    const parsedAmount = parseFloat(settleAmount)
    if (!settleAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      notify('Please enter a valid payment amount.', 'error'); return
    }
    const remaining = invoice.final_amount - (Number(invoice.total_paid_amount) || 0)
    if (parsedAmount > remaining + 0.005) {
      notify(`Payment exceeds remaining balance ($${remaining.toFixed(2)}).`, 'error'); return
    }
    setSettling(true)
    try {
      const res = await addInvoicePayment(invoice.id, {
        payment_method: settleMethod,
        payment_amount: parsedAmount,
        ...(settleRefNo && { payment_reference_no: settleRefNo }),
        ...(settleRemarks && { remarks: settleRemarks }),
      })
      const updatedInvoice = res.data.data.invoice
      setInvoice(updatedInvoice)
      setPayments(updatedInvoice?.PaymentHistory || [])
      setShowSettleForm(false)
      setSettleMethod('')
      setSettleAmount('')
      setSettleRefNo('')
      setSettleRemarks('')
      notify(res.data.message || 'Payment recorded.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to record payment.', 'error')
    } finally {
      setSettling(false)
    }
  }

  const [processModal, setProcessModal] = useState(null)

  // Edit order state
  const [editModal, setEditModal] = useState(null)
  const [editItems, setEditItems] = useState([])
  const [editSearch, setEditSearch] = useState('')
  const [editSearchResults, setEditSearchResults] = useState([])
  const [editSearching, setEditSearching] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const editDebounceRef = useRef(null)

  // Debounced product search for edit modal
  useEffect(() => {
    if (!editModal) return
    clearTimeout(editDebounceRef.current)
    if (!editSearch.trim()) {
      setEditSearchResults([])
      return
    }
    editDebounceRef.current = setTimeout(async () => {
      setEditSearching(true)
      try {
        const res = await getProducts({ search: editSearch, limit: 20, page: 1 })
        setEditSearchResults(res.data.data.products)
      } catch {
        setEditSearchResults([])
      } finally {
        setEditSearching(false)
      }
    }, 350)
    return () => clearTimeout(editDebounceRef.current)
  }, [editSearch, editModal])

  const refresh = () => {
    getOrders().then((res) => setOrders(res.data.data.orders || []))
  }

  const openEdit = (order) => {
    setEditItems(
      (order.OrderItems || []).map((item) => ({
        product_id: item.product_id,
        name: item.Product?.name || `Product #${item.product_id}`,
        unit: item.Product?.unit || '',
        price: item.price,
        stock_quantity: item.Product?.stock_quantity ?? 0,
        quantity: item.approved_qty ?? item.requested_qty,
      }))
    )
    setEditSearch('')
    setEditSearchResults([])
    setEditError(null)
    setEditModal(order)
  }

  const handleEditAdd = (product) => {
    setEditItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit: product.unit || '',
          price: product.price,
          stock_quantity: product.stock_quantity,
          quantity: 1,
        },
      ]
    })
  }

  const handleEditQty = (product_id, value) => {
    const qty = parseInt(value)
    if (isNaN(qty) || qty < 1) return
    setEditItems((prev) =>
      prev.map((i) => (i.product_id === product_id ? { ...i, quantity: qty } : i))
    )
  }

  const submitEdit = async () => {
    if (editItems.length === 0) {
      setEditError('Order must have at least one item.')
      return
    }
    setSavingEdit(true)
    setEditError(null)
    try {
      await editOrder(
        editModal.id,
        editItems.map(({ product_id, quantity }) => ({ product_id, quantity }))
      )
      notify('Order updated successfully.')
      setEditModal(null)
      refresh()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update order. Please try again.')
    } finally {
      setSavingEdit(false)
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

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
        <input
          type="text"
          placeholder="Search order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-44"
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
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
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
                    {EDITABLE_STATUSES.includes(o.status) && (
                      <button
                        onClick={() => openEdit(o)}
                        className="text-xs px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-colors border border-amber-200"
                      >
                        Edit
                      </button>
                    )}
                    {(o.status === 'approved' || o.status === 'dispatched' || o.status === 'delivered') && (
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
      </div>

      {/* Order Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order WS-${detail?.id}`} size="lg">
        {detail && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
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
            <div className="mt-4 mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Invoice Management
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {loadingInvoice ? 'Checking invoice status...' :
                      invoice ? `Invoice #${invoice.id} · ` : 'No invoice generated for this order yet.'}
                    {invoice && (() => {
                      const s = invoice.payment_status
                      const isPaid = s === 'paid' || s === 'settled'
                      const isPartial = s === 'partially_paid'
                      return (
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${
                          isPaid ? 'bg-green-50 text-green-700 border-green-200'
                          : isPartial ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {isPaid ? '✓ Paid' : isPartial ? '~ Partially Paid' : 'Unsettled'}
                        </span>
                      )
                    })()}
                    {invoice && (invoice.payment_status === 'paid' || invoice.payment_status === 'settled') ? null : invoice && (
                      <span className="ml-2 text-gray-400">
                        Paid: {fmt(invoice.total_paid_amount || 0)} · Balance: {fmt((invoice.final_amount || 0) - (invoice.total_paid_amount || 0))}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end flex-shrink-0">
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
                        Download
                      </a>
                      <button
                        onClick={() => handleInvoiceRegeneration()}
                        disabled={generating}
                        className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        {generating ? 'Regenerating...' : 'Regenerate'}
                      </button>
                      {invoice.payment_status !== 'paid' && invoice.payment_status !== 'settled' && !showSettleForm && (
                        <button
                          onClick={() => setShowSettleForm(true)}
                          className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                        >
                          {invoice.payment_status === 'partially_paid' ? 'Record Payment' : 'Settle Transaction'}
                        </button>
                      )}
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

              {/* Payment history — shown when payments exist */}
              {payments.length > 0 && !showSettleForm && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Payment History</p>
                  <div className="border border-gray-200 rounded-md overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Date', 'Method', 'Amount', 'Ref No', 'By', 'Remarks'].map((h) => (
                            <th key={h} className="px-2 py-1.5 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="px-2 py-2 text-gray-600">{new Date(p.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td className="px-2 py-2 font-medium">{p.payment_method === 'MO' ? 'Money Order' : p.payment_method}</td>
                            <td className="px-2 py-2 font-semibold text-green-700">{fmt(p.payment_amount)}</td>
                            <td className="px-2 py-2 font-mono text-gray-500">{p.payment_reference_no || '—'}</td>
                            <td className="px-2 py-2 text-gray-600">{p.VerifiedBy?.name || `User #${p.verified_by_user_id}` || '—'}</td>
                            <td className="px-2 py-2 text-gray-500 max-w-[120px] truncate">{p.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Record Payment form */}
              {showSettleForm && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                  <p className="text-xs font-semibold text-gray-700">Record Payment
                    {invoice && (
                      <span className="ml-2 font-normal text-gray-400">
                        Remaining: {fmt((invoice.final_amount || 0) - (invoice.total_paid_amount || 0))}
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Payment Method <span className="text-red-500">*</span></label>
                      <select
                        value={settleMethod}
                        onChange={(e) => setSettleMethod(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">Select…</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Check">Check</option>
                        <option value="MO">Money Order (MO)</option>
                        <option value="Adjusted">Adjusted</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Payment Amount <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={invoice ? invoice.final_amount - (invoice.total_paid_amount || 0) : undefined}
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        placeholder={invoice ? `Max ${fmt(invoice.final_amount - (invoice.total_paid_amount || 0))}` : '0.00'}
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Payment Ref No</label>
                      <input
                        type="text"
                        value={settleRefNo}
                        onChange={(e) => setSettleRefNo(e.target.value)}
                        placeholder="e.g. CHK-12345"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium block mb-1">Remarks</label>
                      <input
                        type="text"
                        value={settleRemarks}
                        onChange={(e) => setSettleRemarks(e.target.value)}
                        placeholder="Any notes…"
                        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSettle}
                      disabled={settling || !settleMethod || !settleAmount}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-1.5 text-xs rounded-md transition-colors"
                    >
                      {settling ? 'Saving…' : 'Record Payment'}
                    </button>
                    <button
                      onClick={() => setShowSettleForm(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-1.5 rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden min-w-[420px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Price', 'Requested', 'Approved', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
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
          </div>
        )}
      </Modal>

      {/* Edit Order Modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`Edit Order WS-${editModal?.id}`}
        size="xl"
      >
        {editModal && (() => {
          const editTotal = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
          return (
            <div className="space-y-5">
              {editError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {editError}
                </div>
              )}

              {/* Current Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Items</h4>
                  <span className="text-xs text-gray-400">{editItems.length} item{editItems.length !== 1 ? 's' : ''}</span>
                </div>

                {editItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-400">No items. Search and add products below.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Product', 'Unit Price', 'Stock', 'Quantity', 'Subtotal', ''].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {editItems.map((item) => (
                          <tr key={item.product_id} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">
                              {item.name}
                              {item.unit && <span className="ml-1 text-xs text-gray-400">/ {item.unit}</span>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{fmt(item.price)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-medium ${
                                item.stock_quantity === 0 ? 'text-red-500' :
                                item.stock_quantity < 10 ? 'text-amber-500' : 'text-gray-400'
                              }`}>
                                {item.stock_quantity === 0 ? 'Out of stock' : `${item.stock_quantity} avail.`}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditItems((prev) =>
                                    prev.map((i) => i.product_id === item.product_id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)
                                  )}
                                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors font-bold"
                                >−</button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleEditQty(item.product_id, e.target.value)}
                                  className="w-14 text-center border border-gray-300 rounded-md px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <button
                                  onClick={() => setEditItems((prev) =>
                                    prev.map((i) => i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i)
                                  )}
                                  className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors font-bold"
                                >+</button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-gray-900">{fmt(item.price * item.quantity)}</td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => setEditItems((prev) => prev.filter((i) => i.product_id !== item.product_id))}
                                className="text-gray-300 hover:text-red-500 transition-colors"
                                title="Remove item"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Products */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add Products</h4>
                <input
                  type="text"
                  placeholder="Search products by name…"
                  value={editSearch}
                  onChange={(e) => setEditSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {editSearch.trim() && (
                  <div className="mt-1.5 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
                    {editSearching ? (
                      <p className="text-center text-sm text-gray-400 py-5">Searching…</p>
                    ) : editSearchResults.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-5">No products found.</p>
                    ) : (
                      editSearchResults.map((product) => {
                        const alreadyIn = editItems.some((i) => i.product_id === product.id)
                        return (
                          <div key={product.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="w-9 h-9 rounded-md object-contain border border-gray-100 bg-white shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-indigo-400">{product.name?.charAt(0)?.toUpperCase()}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                <span className="font-medium text-gray-600">{fmt(product.price)}</span>
                                <span className="mx-1.5">·</span>
                                <span className={
                                  product.stock_quantity === 0 ? 'text-red-500 font-medium' :
                                  product.stock_quantity < 10 ? 'text-amber-500 font-medium' : ''
                                }>
                                  {product.stock_quantity === 0 ? 'Out of stock' : `${product.stock_quantity} in stock`}
                                </span>
                                {product.sub_category && <><span className="mx-1.5">·</span>{product.sub_category}</>}
                              </p>
                            </div>
                            <button
                              onClick={() => handleEditAdd(product)}
                              disabled={product.stock_quantity === 0}
                              className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors shrink-0 ${
                                product.stock_quantity === 0
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : alreadyIn
                                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {alreadyIn ? '+1' : 'Add'}
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Footer: total + actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Estimated Total</p>
                  <p className="text-xl font-bold text-indigo-700">{fmt(editTotal)}</p>
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setEditModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEdit}
                    disabled={savingEdit || editItems.length === 0}
                    className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingEdit ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
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
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden min-w-[540px]">
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
            </div>

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
