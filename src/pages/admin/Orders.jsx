import { useState, useEffect, useRef } from 'react'
import { getOrders, getShops, updateOrderStatus, deleteOrder, getInvoice, generateInvoice, regenerateInvoice, processOrder, addInvoicePayment, editOrder, getProducts, getOrderLogs, createOrder } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import { PageLayout, PageHeader, Button, SearchBar, TableToolbar, FilterBar, DataTable, Dialog as Modal } from '../../components/DesignSystem'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const fmtDate = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—')
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

const STATUSES = ['pending', 'approved', 'dispatched', 'delivered']
const FILTERS = ['All', ...STATUSES, 'Cancelled / Rejected']

const NEXT_STATUS = {
  pending: ['approved'],
  approved: ['dispatched'],
  dispatched: ['delivered'],
}

const EDITABLE_STATUSES = ['pending', 'approved']

const ACTION_LABELS = {
  item_added: 'Added',
  item_removed: 'Removed',
  quantity_changed: 'Qty Changed',
  price_changed: 'Price Changed',
}
const ACTION_COLORS = {
  item_added: 'bg-green-50 text-green-700 border-green-200',
  item_removed: 'bg-red-50 text-red-700 border-red-200',
  quantity_changed: 'bg-blue-50 text-blue-700 border-blue-200',
  price_changed: 'bg-purple-50 text-purple-700 border-purple-200',
}
const fmtLogVal = (action, val) => {
  if (!val) return '—'
  if (action === 'item_added' || action === 'item_removed')
    return `Qty: ${val.quantity} · ${fmt(val.price)}`
  if (action === 'quantity_changed') return `${val.quantity} units`
  if (action === 'price_changed') return fmt(val.price)
  return JSON.stringify(val)
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [shopsList, setShopsList] = useState([])
  const [storeMap, setStoreMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [detail, setDetail] = useState(null)
  const [updating, setUpdating] = useState(null)

  const [detailTab, setDetailTab] = useState('details')
  const [editLogs, setEditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)

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

  // Delete rejected order state
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Create Manual Order state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSelectedShop, setCreateSelectedShop] = useState(null)
  const [shopFilterSearch, setShopFilterSearch] = useState('')
  const [createItems, setCreateItems] = useState([])
  const [createProductSearch, setCreateProductSearch] = useState('')
  const [createProductResults, setCreateProductResults] = useState([])
  const [createProductSearching, setCreateProductSearching] = useState(false)
  const [createOrderStatus, setCreateOrderStatus] = useState('approved')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [createError, setCreateError] = useState(null)
  const createDebounceRef = useRef(null)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      setOrders(oRes.data.data.orders || [])
      const stores = sRes.data.data.shops || []
      setShopsList(stores)
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
    setDetailTab('details')
    setEditLogs([])
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

      setLoadingLogs(true)
      getOrderLogs(detail.id)
        .then((res) => setEditLogs(res.data.data.logs || []))
        .catch(() => setEditLogs([]))
        .finally(() => setLoadingLogs(false))
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

  const openCreateModal = () => {
    setCreateSelectedShop(null)
    setShopFilterSearch('')
    setCreateItems([])
    setCreateProductSearch('')
    setCreateProductResults([])
    setCreateOrderStatus('approved')
    setCreateError(null)
    setShowCreateModal(true)
  }

  // Debounced product search for create manual order modal
  useEffect(() => {
    if (!showCreateModal) return
    clearTimeout(createDebounceRef.current)
    if (!createProductSearch.trim()) {
      setCreateProductResults([])
      return
    }
    createDebounceRef.current = setTimeout(async () => {
      setCreateProductSearching(true)
      try {
        const res = await getProducts({ search: createProductSearch, limit: 20, page: 1 })
        setCreateProductResults(res.data.data.products || [])
      } catch {
        setCreateProductResults([])
      } finally {
        setCreateProductSearching(false)
      }
    }, 350)
    return () => clearTimeout(createDebounceRef.current)
  }, [createProductSearch, showCreateModal])

  const handleCreateAddItem = (product) => {
    setCreateItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      const effectivePrice = (product.deal_price !== null && product.deal_price !== undefined && product.deal_price > 0)
        ? product.deal_price
        : product.price
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          notify(`Cannot exceed available stock (${product.stock_quantity})`, 'error')
          return prev
        }
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku_id: product.sku_id,
          unit: product.unit || '',
          price: product.price,
          deal_price: product.deal_price,
          effective_price: effectivePrice,
          stock_quantity: product.stock_quantity,
          image_url: product.image_url,
          quantity: 1,
        },
      ]
    })
  }

  const handleCreateQtyChange = (productId, val) => {
    const qty = parseInt(val, 10)
    if (isNaN(qty)) return
    setCreateItems((prev) =>
      prev.map((i) => {
        if (i.product_id === productId) {
          const clamped = Math.max(1, Math.min(qty, i.stock_quantity))
          return { ...i, quantity: clamped }
        }
        return i
      })
    )
  }

  const handleCreateRemoveItem = (productId) => {
    setCreateItems((prev) => prev.filter((i) => i.product_id !== productId))
  }

  const submitCreateOrder = async () => {
    if (!createSelectedShop) {
      setCreateError('Please select a store.')
      return
    }
    if (createItems.length === 0) {
      setCreateError('Please add at least one product to the order.')
      return
    }

    for (const item of createItems) {
      if (!item.quantity || item.quantity <= 0) {
        setCreateError(`Quantity for "${item.name}" must be at least 1.`)
        return
      }
      if (item.quantity > item.stock_quantity) {
        setCreateError(`Quantity for "${item.name}" exceeds available stock (${item.stock_quantity}).`)
        return
      }
    }

    setCreatingOrder(true)
    setCreateError(null)

    try {
      const payload = {
        shop_id: createSelectedShop.id,
        items: createItems.map((item) => ({
          product_id: item.product_id,
          requested_qty: item.quantity,
        })),
        status: createOrderStatus,
        source: 'Admin',
      }
      const res = await createOrder(payload)
      const orderId = res.data?.data?.order?.id
      notify(`Order WS-${orderId || ''} created successfully!`)
      setShowCreateModal(false)
      refresh()
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create order. Please check inputs.')
    } finally {
      setCreatingOrder(false)
    }
  }

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
        quantity: order.status === 'pending' ? item.requested_qty : (item.approved_qty ?? item.requested_qty),
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
    const actionWord = status === 'rejected' ? 'reject' : `update to "${status}"`
    if (!confirm(`Are you sure you want to ${actionWord} order WS-${order.id}?`)) return
    setUpdating(order.id)
    try {
      await updateOrderStatus(order.id, status)
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status } : o))
      )
      if (detail?.id === order.id) setDetail((d) => ({ ...d, status }))
      notify(`Order marked as ${status}.`)
    } catch (err) {
      notify(err.response?.data?.message || 'Update failed.', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteOrder = async () => {
    if (!deleteConfirmOrder) return
    setDeleting(true)
    try {
      await deleteOrder(deleteConfirmOrder.id)
      setOrders((prev) => prev.filter((o) => o.id !== deleteConfirmOrder.id))
      if (detail?.id === deleteConfirmOrder.id) {
        setDetail(null)
      }
      setDeleteConfirmOrder(null)
      notify('Rejected order permanently deleted.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete order.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const visible = orders.filter((o) => {
    if (filter === 'Cancelled / Rejected') {
      if (o.status !== 'cancelled' && o.status !== 'rejected') return false
    } else if (filter !== 'All' && o.status !== filter) {
      return false
    }
    if (search && !String(o.id).includes(search) && !(storeMap[o.shop_id] || '').toLowerCase().includes(search.toLowerCase())) return false
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
    <PageLayout>
      <PageHeader
        title="Orders"
        subtitle={`${orders.filter(o => o.status === 'pending').length} pending orders`}
        action={
          <Button
            variant="primary"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Order
          </Button>
        }
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order ID or store..."
        />
      </TableToolbar>

      <DataTable
        headers={['S.No', 'Order ID', 'Store', 'Items', 'Total', 'Status', 'Date', 'Actions']}
        empty={visible.length === 0}
      >
            {visible.map((o, index) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setDetail(o)}
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      WS-{o.id}
                    </button>
                    {o.source === 'Admin' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-semibold bg-purple-50 text-purple-700 border border-purple-200" title="Manual / Admin Created">
                        Manual
                      </span>
                    )}
                  </div>
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
                    {o.status === 'pending' && (
                      <button
                        onClick={() => doStatusUpdate(o, 'rejected')}
                        disabled={updating === o.id}
                        className="text-xs px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium transition-colors border border-rose-200 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    )}
                    {(o.status === 'rejected' || o.status === 'cancelled') && (
                      <button
                        onClick={() => setDeleteConfirmOrder(o)}
                        disabled={updating === o.id || deleting}
                        className="text-xs px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                        title={`Permanently delete this ${o.status} order`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Order
                      </button>
                    )}
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
      </DataTable>

      {/* Order Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Order WS-${detail?.id}`} size="xl">
        {detail && (
          <div>
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5 -mt-1">
              {[['details', 'Details'], ['history', 'Edit History']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDetailTab(key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === key
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {label}
                  {key === 'history' && editLogs.length > 0 && (
                    <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold">
                      {editLogs.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Edit History Tab */}
            {detailTab === 'history' && (
              <div>
                {loadingLogs ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Loading history…</p>
                ) : editLogs.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">No edits recorded for this order.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Date & Time', 'Edited By', 'Action', 'Product', 'Previous Value', 'New Value'].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {editLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtTime(log.created_at)}</td>
                            <td className="px-3 py-2.5">
                              {log.User ? (
                                <div>
                                  <p className="font-medium text-gray-800">{log.User.name}</p>
                                  <p className="text-xs text-gray-400">{log.User.role}</p>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800">{log.product_name || `#${log.product_id}`}</td>
                            <td className="px-3 py-2.5 text-gray-500">{fmtLogVal(log.action, log.previous_value)}</td>
                            <td className="px-3 py-2.5 text-gray-800">{fmtLogVal(log.action, log.new_value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Details Tab */}
            {detailTab === 'details' && <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Store</p>
                <p className="font-medium">{storeMap[detail.shop_id] || `Store #${detail.shop_id}`}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide">Order Source</p>
                <p className="font-medium text-xs mt-0.5">
                  {detail.source === 'Admin' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      Manual / Admin Created
                    </span>
                  ) : (
                    <span className="text-gray-700 font-medium">Mobile App</span>
                  )}
                </p>
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
                  const qty = detail.status === 'pending' ? item.requested_qty : (item.approved_qty ?? item.requested_qty)
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
                        <span className={detail.status !== 'pending' && item.approved_qty != null && item.approved_qty < item.requested_qty ? 'text-amber-600 font-medium' : ''}>
                          {detail.status === 'pending' ? '—' : (item.approved_qty ?? '—')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium">{fmt(itemPrice * qty)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>

            {(detail.status === 'rejected' || detail.status === 'cancelled') && (
              <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-red-900 capitalize">{detail.status} Order</h4>
                  <p className="text-xs text-red-600 mt-0.5">This order has been {detail.status} and can be permanently deleted.</p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setDeleteConfirmOrder(detail)}
                  className="text-xs"
                >
                  Delete Order
                </Button>
              </div>
            )}
            </div>}
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

      {/* Delete Rejected Order Confirmation Dialog */}
      <Modal
        open={!!deleteConfirmOrder}
        onClose={() => !deleting && setDeleteConfirmOrder(null)}
        title="Delete Rejected Order"
        size="sm"
      >
        {deleteConfirmOrder && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-900">Permanent Deletion</h4>
                <p className="text-xs text-red-700 mt-1">
                  Are you sure you want to permanently delete this {deleteConfirmOrder.status} order (<strong>WS-{deleteConfirmOrder.id}</strong>)?
                </p>
                <p className="text-2xs text-red-600 mt-1 font-semibold">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg space-y-1">
              <div className="flex justify-between">
                <span>Store:</span>
                <span className="font-medium text-gray-800">{storeMap[deleteConfirmOrder.shop_id] || `Store #${deleteConfirmOrder.shop_id}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-medium text-gray-800">{fmt(deleteConfirmOrder.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-semibold text-rose-600 uppercase text-3xs">{deleteConfirmOrder.status}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setDeleteConfirmOrder(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleting}
                onClick={handleDeleteOrder}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Manual Order Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => !creatingOrder && setShowCreateModal(false)}
        title="Create Manual Order"
        size="xl"
      >
        <div className="space-y-6">
          {createError && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 font-medium">{createError}</div>
            </div>
          )}

          {/* Step 1: Shop Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">1</span>
                Select Existing Store <span className="text-red-500">*</span>
              </label>
              {createSelectedShop && (
                <button
                  type="button"
                  onClick={() => setCreateSelectedShop(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors hover:underline"
                >
                  Change Store
                </button>
              )}
            </div>

            {createSelectedShop ? (
              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    {createSelectedShop.shop_name?.charAt(0)?.toUpperCase() || 'S'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{createSelectedShop.shop_name}</h4>
                      <StatusBadge status={createSelectedShop.approved ? 'approved' : 'pending'} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Owner: <strong className="text-gray-700">{createSelectedShop.owner_name || '—'}</strong></span>
                      <span>·</span>
                      <span>{createSelectedShop.email || '—'}</span>
                      {createSelectedShop.city && (
                        <>
                          <span>·</span>
                          <span>{createSelectedShop.city}{createSelectedShop.state ? `, ${createSelectedShop.state}` : ''}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateSelectedShop(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg shadow-2xs transition-colors shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={shopFilterSearch}
                    onChange={(e) => setShopFilterSearch(e.target.value)}
                    placeholder="Search store by name, owner, phone number, email, or city..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {!shopFilterSearch.trim() ? (
                  <div className="p-5 border border-dashed border-gray-200 rounded-xl bg-gray-50/60 text-center">
                    <svg className="w-6 h-6 mx-auto text-gray-300 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-xs font-semibold text-gray-700">Search for an Approved Store</p>
                    <p className="text-2xs text-gray-400 mt-0.5">Type store name, owner name, phone number, email, or city to find and select a store.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-100 bg-white shadow-2xs">
                    {(() => {
                      const approvedShops = shopsList.filter((s) => s.approved)
                      const q = shopFilterSearch.toLowerCase().trim()
                      const filtered = approvedShops.filter((s) => {
                        return (
                          (s.shop_name && s.shop_name.toLowerCase().includes(q)) ||
                          (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
                          (s.email && s.email.toLowerCase().includes(q)) ||
                          (s.city && s.city.toLowerCase().includes(q)) ||
                          (s.contact_number && s.contact_number.includes(q)) ||
                          String(s.id).includes(q)
                        )
                      })

                      if (filtered.length === 0) {
                        return (
                          <div className="p-6 text-center text-sm text-gray-400">
                            No approved store found matching &ldquo;{shopFilterSearch}&rdquo;.
                          </div>
                        )
                      }

                      return filtered.slice(0, 30).map((shop) => (
                        <div
                          key={shop.id}
                          className="p-3 hover:bg-indigo-50/40 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                          onClick={() => setCreateSelectedShop(shop)}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-gray-900 truncate">{shop.shop_name}</span>
                              <span className="text-2xs text-gray-400">ID: {shop.id}</span>
                              <span className="text-3xs px-1.5 py-0.5 rounded font-semibold uppercase bg-green-50 text-green-700 border border-green-200">
                                Approved
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {shop.owner_name && <span>{shop.owner_name} · </span>}
                              {shop.contact_number && <span>{shop.contact_number} · </span>}
                              {shop.email && <span>{shop.email} · </span>}
                              {shop.city && <span>{shop.city}{shop.state ? `, ${shop.state}` : ''}</span>}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            className="text-xs py-1 px-3 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCreateSelectedShop(shop)
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Add Products & Variations */}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">2</span>
              Add Products & Variations
            </label>

            <div className="relative">
              <input
                type="text"
                placeholder="Search products by name, SKU, or category to add…"
                value={createProductSearch}
                onChange={(e) => setCreateProductSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {createProductSearch.trim() && (
              <div className="mt-2 border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-56 overflow-y-auto bg-white shadow-md">
                {createProductSearching ? (
                  <p className="text-center text-sm text-gray-400 py-6">Searching products…</p>
                ) : createProductResults.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">No products found matching "{createProductSearch}".</p>
                ) : (
                  createProductResults.map((product) => {
                    const alreadyIn = createItems.find((i) => i.product_id === product.id)
                    const isOutOfStock = product.stock_quantity <= 0
                    const isMaxStockAdded = alreadyIn && alreadyIn.quantity >= product.stock_quantity
                    const hasDeal = product.deal_price !== null && product.deal_price !== undefined && product.deal_price > 0
                    const effectivePrice = hasDeal ? product.deal_price : product.price

                    return (
                      <div key={product.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-contain border border-gray-100 bg-white shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-indigo-500">{product.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                            {product.sku_id && (
                              <span className="text-3xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                                {product.sku_id}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            {hasDeal ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-green-600">{fmt(effectivePrice)}</span>
                                <span className="text-gray-400 line-through text-2xs">{fmt(product.price)}</span>
                                <span className="text-3xs px-1 py-0.5 rounded bg-green-50 text-green-700 font-semibold">Deal</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-gray-700">{fmt(product.price)}</span>
                            )}
                            <span>·</span>
                            <span className={
                              isOutOfStock ? 'text-red-500 font-semibold' :
                              product.stock_quantity < 10 ? 'text-amber-500 font-medium' : 'text-gray-500'
                            }>
                              {isOutOfStock ? 'Out of stock' : `${product.stock_quantity} available`}
                            </span>
                            {product.sub_category && (
                              <>
                                <span>·</span>
                                <span className="text-gray-400">{product.sub_category}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCreateAddItem(product)}
                          disabled={isOutOfStock || isMaxStockAdded}
                          className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all shrink-0 shadow-2xs ${
                            isOutOfStock || isMaxStockAdded
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                              : alreadyIn
                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : isMaxStockAdded ? 'Max Added' : alreadyIn ? `+1 (In Cart: ${alreadyIn.quantity})` : 'Add to Order'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Step 3: Selected Items in Order */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">3</span>
                Order Items ({createItems.length})
              </label>
              {createItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCreateItems([])}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {createItems.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-sm font-medium text-gray-600">No items added to this order yet</p>
                <p className="text-xs text-gray-400 mt-0.5">Use the search box above to find and add products</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto shadow-2xs">
                <table className="w-full text-sm min-w-[540px]">
                  <thead className="bg-gray-50/80 border-b border-gray-200">
                    <tr>
                      {['Product', 'Unit Price', 'Available', 'Quantity', 'Subtotal', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {createItems.map((item) => (
                      <tr key={item.product_id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="w-8 h-8 rounded object-contain border border-gray-100 shrink-0" />
                            ) : null}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                              <div className="flex items-center gap-1.5 text-2xs text-gray-400">
                                {item.sku_id && <span>SKU: {item.sku_id}</span>}
                                {item.unit && <span>· {item.unit}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {item.deal_price !== null && item.deal_price !== undefined && item.deal_price > 0 ? (
                            <div>
                              <span className="font-bold text-green-600">{fmt(item.effective_price)}</span>
                              <span className="text-2xs text-gray-400 line-through ml-1">{fmt(item.price)}</span>
                            </div>
                          ) : (
                            <span className="font-semibold">{fmt(item.price)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-semibold ${
                            item.stock_quantity === 0 ? 'text-red-500' :
                            item.stock_quantity < 10 ? 'text-amber-500' : 'text-gray-500'
                          }`}>
                            {item.stock_quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCreateItems((prev) =>
                                prev.map((i) => i.product_id === item.product_id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)
                              )}
                              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors font-bold shadow-2xs"
                            >−</button>
                            <input
                              type="number"
                              min="1"
                              max={item.stock_quantity}
                              value={item.quantity}
                              onChange={(e) => handleCreateQtyChange(item.product_id, e.target.value)}
                              className="w-14 text-center border border-gray-300 rounded-md px-1 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={() => setCreateItems((prev) =>
                                prev.map((i) => i.product_id === item.product_id ? { ...i, quantity: Math.min(item.stock_quantity, i.quantity + 1) } : i)
                              )}
                              disabled={item.quantity >= item.stock_quantity}
                              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 transition-colors font-bold shadow-2xs disabled:opacity-40"
                            >+</button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-gray-900">{fmt(item.effective_price * item.quantity)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleCreateRemoveItem(item.product_id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
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

          {/* Step 4: Order Status Flow & Totals */}
          <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                  Initial Order Status
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-2.5 p-2.5 border rounded-lg cursor-pointer transition-all ${
                    createOrderStatus === 'approved' ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="orderStatus"
                      value="approved"
                      checked={createOrderStatus === 'approved'}
                      onChange={() => setCreateOrderStatus('approved')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-900">Approved</span>
                        <span className="text-3xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase">Recommended</span>
                      </div>
                      <p className="text-2xs text-gray-500 mt-0.5">Deducts stock immediately and generates standard Invoice PDF.</p>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 border rounded-lg cursor-pointer transition-all ${
                    createOrderStatus === 'pending' ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="orderStatus"
                      value="pending"
                      checked={createOrderStatus === 'pending'}
                      onChange={() => setCreateOrderStatus('pending')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-gray-900">Pending</span>
                      <p className="text-2xs text-gray-500 mt-0.5">Creates a pending order for review before approving/dispatching.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Order Calculation Review */}
              <div className="flex flex-col justify-between bg-white border border-gray-200 rounded-lg p-3.5">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Store:</span>
                    <span className="font-semibold text-gray-800">{createSelectedShop?.shop_name || 'None selected'}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Total Line Items:</span>
                    <span className="font-semibold text-gray-800">{createItems.length} items</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Total Units:</span>
                    <span className="font-semibold text-gray-800">
                      {createItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)} units
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Calculated Total</span>
                  <span className="text-xl font-extrabold text-indigo-700">
                    {fmt(createItems.reduce((sum, item) => sum + item.effective_price * item.quantity, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <Button
              variant="secondary"
              disabled={creatingOrder}
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={creatingOrder || !createSelectedShop || createItems.length === 0}
              onClick={submitCreateOrder}
              className="flex items-center gap-1.5 shadow-sm min-w-[140px] justify-center"
            >
              {creatingOrder ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating…
                </>
              ) : (
                'Create Order'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
