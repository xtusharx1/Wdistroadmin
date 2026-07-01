import { useState, useEffect } from 'react'
import { getUser } from '../../auth'
import { getSalesAssignments, getOrders, updateOrderStatus, getInvoice, generateInvoice, regenerateInvoice, processOrder } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

export default function AssignedStores() {
  const me = getUser()
  const [assignments, setAssignments] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Active')

  // Modals state
  const [selectedStore, setSelectedStore] = useState(null)
  const [activeTab, setActiveTab] = useState('details') // 'details' | 'orders' | 'invoices'
  
  const [orderDetail, setOrderDetail] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  
  const [processModal, setProcessModal] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([getSalesAssignments(), getOrders()])
      .then(([aRes, oRes]) => {
        const all = aRes.data.data.assignments || []
        setAssignments(all.filter((a) => a.sales_exec_id === me?.id))
        setOrders(oRes.data.data.orders || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [me?.id])

  // Load invoice details when order detail modal is opened
  useEffect(() => {
    if (orderDetail) {
      setLoadingInvoice(true)
      getInvoice(orderDetail.id)
        .then((res) => setInvoice(res.data.data.invoice))
        .catch(() => setInvoice(null))
        .finally(() => setLoadingInvoice(false))
    } else {
      setInvoice(null)
    }
  }, [orderDetail])

  const handleInvoiceGeneration = async () => {
    setGeneratingInvoice(true)
    try {
      const res = await generateInvoice(orderDetail.id)
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
      setOrderDetail(prev => prev && prev.id === order.id ? { ...prev, status } : prev)
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
    setUpdatingStatus('process')
    try {
      await processOrder(
        processModal.order.id,
        processModal.items.map(({ id, approved_qty }) => ({ id, approved_qty }))
      )
      alert('Order approved and processed successfully.')
      setProcessModal(null)
      setOrderDetail(null)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process order.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const visible =
    filter === 'Active'
      ? assignments.filter((a) => !a.end_date)
      : filter === 'Historical'
      ? assignments.filter((a) => !!a.end_date)
      : assignments

  if (loading && assignments.length === 0) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assigned Stores</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {assignments.filter((a) => !a.end_date).length} active assignment
            {assignments.filter((a) => !a.end_date).length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {['Active', 'Historical', 'All'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">No assigned stores in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((a) => {
            const shop = a.Shop || {}
            const isActive = !a.end_date
            return (
              <div
                key={a.id}
                className={`bg-white rounded-lg border p-5 ${
                  isActive ? 'border-gray-200' : 'border-gray-100 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {shop.shop_name || `Store #${a.shop_id}`}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{shop.owner_name || '—'}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isActive ? 'Active' : 'Ended'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600">
                  {shop.contact_details && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-14">Phone</span>
                      <span>{shop.contact_details}</span>
                    </div>
                  )}
                  {(shop.city || shop.state) && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-14">Location</span>
                      <span>{[shop.city, shop.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1 border-t border-gray-100 mt-2">
                    <span className="text-gray-400 w-14">Assigned</span>
                    <span>{fmtDate(a.start_date)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedStore(shop)
                    setActiveTab('details')
                  }}
                  className="mt-4 w-full py-1.5 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium text-xs rounded transition-colors"
                >
                  View Store Details
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Store Details Modal */}
      <Modal
        open={!!selectedStore}
        onClose={() => setSelectedStore(null)}
        title={selectedStore?.shop_name || 'Store Details'}
        size="lg"
      >
        {selectedStore && (
          <div>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5">
              {['details', 'orders', 'invoices'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Store Name</p>
                  <p className="font-semibold mt-1">{selectedStore.shop_name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Owner Name</p>
                  <p className="font-semibold mt-1">{selectedStore.owner_name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Phone Number</p>
                  <p className="mt-1">{selectedStore.contact_details || '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Seller Permit</p>
                  <p className="font-mono mt-1">{selectedStore.seller_permit || '—'}</p>
                </div>
                <div className="sm:col-span-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Address</p>
                  <p className="mt-1">
                    {[selectedStore.address, selectedStore.city, selectedStore.state, selectedStore.zip]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto text-sm">
                <table className="w-full text-left min-w-[480px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Order ID</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Date</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Total</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Status</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders
                      .filter((o) => o.shop_id === selectedStore.id)
                      .map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-indigo-600">WS-{o.id}</td>
                          <td className="px-4 py-2.5 text-gray-500">{fmtDate(o.created_at)}</td>
                          <td className="px-4 py-2.5 font-semibold">{fmt(o.total_amount)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={o.status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => setOrderDetail(o)}
                              className="text-xs px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-medium"
                            >
                              Manage Order
                            </button>
                          </td>
                        </tr>
                      ))}
                    {orders.filter((o) => o.shop_id === selectedStore.id).length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-gray-400 py-10">No orders for this store yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto text-sm">
                <table className="w-full text-left min-w-[520px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Invoice ID</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Order ID</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Grand Total</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Generated At</th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders
                      .filter((o) => o.shop_id === selectedStore.id && o.Invoice)
                      .map((o) => {
                        const inv = o.Invoice
                        return (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-900">INV-{inv.id}</td>
                            <td className="px-4 py-2.5 text-indigo-600">WS-{o.id}</td>
                            <td className="px-4 py-2.5 font-semibold text-gray-900">{fmt(inv.final_amount)}</td>
                            <td className="px-4 py-2.5 text-gray-500">{fmtDate(inv.generated_at)}</td>
                            <td className="px-4 py-2.5">
                              {inv.pdf_url && (
                                <div className="flex gap-2">
                                  <a
                                    href={inv.pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-medium inline-block"
                                  >
                                    View
                                  </a>
                                  <a
                                    href={inv.pdf_url}
                                    download={`invoice-${o.id}.pdf`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium inline-block"
                                  >
                                    Download
                                  </a>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    {orders.filter((o) => o.shop_id === selectedStore.id && o.Invoice).length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center text-gray-400 py-10">No invoices generated for this store yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Order Detail Modal */}
      <Modal open={!!orderDetail} onClose={() => setOrderDetail(null)} title={`Order WS-${orderDetail?.id}`} size="lg">
        {orderDetail && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Store</p>
                <p className="font-medium">{selectedStore?.shop_name || `Store #${orderDetail.shop_id}`}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Status</p>
                <div className="mt-0.5"><StatusBadge status={orderDetail.status} /></div>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Placed</p>
                <p>{fmtTime(orderDetail.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Total</p>
                <p className="font-bold text-indigo-700">{fmt(orderDetail.total_amount)}</p>
              </div>
              {orderDetail.approved_at && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Approved</p>
                  <p>{fmtTime(orderDetail.approved_at)}</p>
                </div>
              )}
              {orderDetail.dispatched_at && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Dispatched</p>
                  <p>{fmtTime(orderDetail.dispatched_at)}</p>
                </div>
              )}
              {orderDetail.delivered_at && (
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Delivered</p>
                  <p>{fmtTime(orderDetail.delivered_at)}</p>
                </div>
              )}
            </div>

            {/* Quick Status Action Buttons */}
            <div className="flex gap-2 flex-wrap mb-5">
              {orderDetail.status === 'pending' && (
                <button
                  onClick={() => openProcess(orderDetail)}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                >
                  Process & Approve Order
                </button>
              )}
              {orderDetail.status === 'approved' && (
                <button
                  onClick={() => doStatusUpdate(orderDetail, 'dispatched')}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  Mark Dispatched
                </button>
              )}
              {orderDetail.status === 'dispatched' && (
                <button
                  onClick={() => doStatusUpdate(orderDetail, 'delivered')}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                >
                  Mark Delivered
                </button>
              )}
            </div>

            {/* Invoice Section */}
            {(orderDetail.status === 'delivered' || orderDetail.status === 'completed') && (
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
                        download={`invoice-${orderDetail.id}.pdf`}
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
                {(orderDetail.OrderItems || []).map((item) => {
                  const qty = item.approved_qty ?? item.requested_qty
                  const itemPrice = item.custom_price !== null && item.custom_price !== undefined ? item.custom_price : item.price
                  const isCustom = item.custom_price !== null && item.custom_price !== undefined
                  return (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5">{item.Product?.name || `Product #${item.product_id}`}</td>
                      <td className="px-3 py-2.5">
                        {isCustom ? (
                          <div className="flex flex-col">
                            <span className="text-green-600 font-semibold">{fmt(itemPrice)}</span>
                            <span className="text-xs text-gray-400 line-through">{fmt(item.price)}</span>
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
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden min-w-[500px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Product', 'Unit Price', 'Requested', 'Approve Qty', 'Subtotal'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processModal.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5 font-medium">
                      {item.name}
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
                        className={`w-20 border rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${item.approved_qty < item.requested_qty
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
            </div>

            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-gray-500">Approved Total</span>
              <span className="text-lg font-bold text-indigo-700">
                {fmt(
                  processModal.items.reduce((s, i) => s + i.price * i.approved_qty, 0)
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
