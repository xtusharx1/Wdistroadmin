import { useState, useEffect } from 'react'
import { getUser } from '../../auth'
import { getSalesAssignments, getOrders, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, processOrder, addInvoicePayment } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import { PageLayout, PageHeader, Button, SearchBar, TableToolbar, FilterBar, DataTable, Dialog as Modal } from '../../components/DesignSystem'

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
  const [search, setSearch] = useState('')
  
  // Modals state
  const [detail, setDetail] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  
  const [processModal, setProcessModal] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(null)
  const [settling, setSettling] = useState(false)
  const [showSettleForm, setShowSettleForm] = useState(false)
  const [settleMethod, setSettleMethod] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [settleRefNo, setSettleRefNo] = useState('')
  const [settleRemarks, setSettleRemarks] = useState('')
  const [payments, setPayments] = useState([])

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
        .catch(() => { setInvoice(null); setPayments([]) })
        .finally(() => setLoadingInvoice(false))
    } else {
      setInvoice(null)
      setPayments([])
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

  const handleSettle = async () => {
    if (!settleMethod) { alert('Please select a payment method.'); return }
    const parsedAmount = parseFloat(settleAmount)
    if (!settleAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid payment amount.'); return
    }
    const remaining = invoice.final_amount - (Number(invoice.total_paid_amount) || 0)
    if (parsedAmount > remaining + 0.005) {
      alert(`Payment exceeds remaining balance ($${remaining.toFixed(2)}).`); return
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
      alert(res.data.message || 'Payment recorded.')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record payment.')
    } finally {
      setSettling(false)
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

  const visible = (
    filter === 'All' ? orders : orders.filter((o) => o.status === filter)
  ).filter((o) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    const storeName = storeMap[o.shop_id]?.toLowerCase() || ''
    return String(o.id).includes(q) || storeName.includes(q)
  })

  if (loading && orders.length === 0) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  if (assignedStoreIds.size === 0) {
    return (
      <PageLayout>
        <PageHeader title="Orders" />
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">No stores assigned to you yet.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHeader
        title="Orders"
        subtitle={`From your ${assignedStoreIds.size} assigned store${assignedStoreIds.size !== 1 ? 's' : ''}`}
      />

      <TableToolbar>
        <FilterBar>
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'secondary'}
              onClick={() => setFilter(f)}
              className="py-1 px-3 capitalize"
            >
              {f}
            </Button>
          ))}
        </FilterBar>
        <SearchBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by order ID or store name..."
        />
      </TableToolbar>

      <DataTable
        headers={['S.No', 'Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Detail']}
        empty={visible.length === 0}
      >
        {visible.map((o, index) => (
          <tr key={o.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
            <td className="px-4 py-3 font-medium text-gray-900">WS-{o.id}</td>
            <td className="px-4 py-3 text-gray-700">
              {storeMap[o.shop_id] || `Store #${o.shop_id}`}
            </td>
            <td className="px-4 py-3 text-gray-500">{o.OrderItems?.length ?? 0}</td>
            <td className="px-4 py-3 font-medium">{fmt(o.total_amount)}</td>
            <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
            <td className="px-4 py-3 text-gray-500">{fmtDate(o.created_at)}</td>
            <td className="px-4 py-3">
              <Button variant="secondary" onClick={() => setDetail(o)} className="py-0.5 px-2 text-2xs">View &amp; Manage</Button>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* Order Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order WS-${detail?.id}`} size="lg">
        {detail && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
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
            <div className="flex gap-2 flex-wrap mb-5">
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
                          onClick={handleInvoiceRegeneration}
                          disabled={generatingInvoice}
                          className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors"
                        >
                          {generatingInvoice ? 'Regenerating...' : 'Regenerate'}
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
                        onClick={handleInvoiceGeneration}
                        disabled={generatingInvoice}
                        className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Payment history — shown when payments exist */}
                {payments.length > 0 && !showSettleForm && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Payment History</p>
                    <div className="border border-gray-200 rounded-md overflow-hidden overflow-x-auto">
                      <table className="w-full text-xs min-w-[420px]">
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
            )}

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
    </PageLayout>
  )
}
