import { useState, useEffect, useMemo } from 'react'
import { getOrders, getShops, getInvoice, getAllPayments, addInvoicePayment } from '../../api'
import { PageLayout, PageHeader, Button, SearchBar, DataTable } from '../../components/DesignSystem'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtTime = (d) => (d ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d)) : '—')

const statusBadge = (status) => {
  if (status === 'paid' || status === 'settled') return { label: '✓ Paid', cls: 'bg-green-50 text-green-700 border-green-200' }
  if (status === 'partially_paid') return { label: '~ Partial', cls: 'bg-orange-50 text-orange-700 border-orange-200' }
  return { label: 'Unsettled', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
}

export default function PaymentSettlement() {
  const [tab, setTab] = useState('record')

  return (
    <PageLayout>
      <PageHeader
        title="Payment Settlement"
        subtitle="Track and record invoice payments across all orders."
      />

      <div className="flex gap-0 border-b border-gray-200">
        {[
          { key: 'record', label: 'Record Payment' },
          { key: 'history', label: 'Settlement History' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'record' ? <RecordTab /> : <HistoryTab />}
    </PageLayout>
  )
}

function HistoryTab() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAllPayments()
      .then((res) => setPayments(res.data.data.payments || []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return payments
    const q = search.toLowerCase()
    return payments.filter((p) => {
      const invoiceId = String(p.invoice_id)
      const orderId = String(p.Invoice?.Order?.id || '')
      const shop = (p.Invoice?.Order?.Shop?.shop_name || '').toLowerCase()
      const method = p.payment_method.toLowerCase()
      const ref = (p.payment_reference_no || '').toLowerCase()
      const by = (p.VerifiedBy?.name || '').toLowerCase()
      return invoiceId.includes(q) || orderId.includes(q) || shop.includes(q) || method.includes(q) || ref.includes(q) || by.includes(q)
    })
  }, [payments, search])

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>

  return (
    <div>
      <div className="flex items-center gap-3 bg-white p-3 border border-gray-200 rounded-xl shadow-2xs mb-4">
        <p className="text-sm text-gray-500 shrink-0">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice, order, store, method..."
        />
      </div>

      <DataTable
        headers={['#', 'Invoice #', 'Order #', 'Customer', 'Method', 'Amount', 'Ref No', 'Remarks', 'Verified By', 'Date & Time']}
        empty={filtered.length === 0}
      >
              {filtered.map((p, idx) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-3 py-3 font-medium text-gray-900">#{p.invoice_id}</td>
                  <td className="px-3 py-3 text-gray-700">WS-{p.Invoice?.Order?.id || '—'}</td>
                  <td className="px-3 py-3 text-gray-700">{p.Invoice?.Order?.Shop?.shop_name || `Shop #${p.Invoice?.Order?.shop_id}` || '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                      {p.payment_method === 'MO' ? 'Money Order' : p.payment_method}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-green-700">{fmt(p.payment_amount)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{p.payment_reference_no || '—'}</td>
                  <td className="px-3 py-3 text-gray-500 max-w-[140px] truncate">{p.remarks || '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{p.VerifiedBy?.name || `User #${p.verified_by_user_id}` || '—'}</td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{fmtTime(p.verified_at)}</td>
                </tr>
              ))}
      </DataTable>
    </div>
  )
}

function RecordTab() {
  const [orders, setOrders] = useState([])
  const [storeMap, setStoreMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [filterType, setFilterType] = useState('pending') // 'all', 'pending', 'paid'

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [settling, setSettling] = useState(false)

  const [method, setMethod] = useState('')
  const [amount, setAmount] = useState('')
  const [refNo, setRefNo] = useState('')
  const [remarks, setRemarks] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    Promise.all([getOrders(), getShops()]).then(([oRes, sRes]) => {
      const all = oRes.data.data.orders || []
      setOrders(all.filter((o) => o.status === 'dispatched' || o.status === 'delivered' || o.status === 'completed'))
      const shops = sRes.data.data.shops || []
      setStoreMap(shops.reduce((m, s) => ({ ...m, [s.id]: s.shop_name }), {}))
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = orders
    if (filterType === 'pending') {
      result = orders.filter((o) => {
        const remaining = o.Invoice ? o.Invoice.final_amount - (Number(o.Invoice.total_paid_amount) || 0) : o.total_amount
        return remaining > 0.01
      })
    } else if (filterType === 'paid') {
      result = orders.filter((o) => {
        const remaining = o.Invoice ? o.Invoice.final_amount - (Number(o.Invoice.total_paid_amount) || 0) : o.total_amount
        return remaining <= 0.01
      })
    }

    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result.filter((o) => {
      const orderId = `ws-${o.id}`
      const shop = (storeMap[o.shop_id] || '').toLowerCase()
      return orderId.includes(q) || String(o.id).includes(q) || shop.includes(q)
    })
  }, [orders, search, storeMap, filterType])

  const selectOrder = async (order) => {
    setSelectedOrder(order)
    setInvoice(null)
    setMethod('')
    setAmount('')
    setRefNo('')
    setRemarks('')
    setSuccessMsg('')
    setErrorMsg('')
    setLoadingInvoice(true)
    try {
      const res = await getInvoice(order.id)
      setInvoice(res.data.data.invoice)
    } catch {
      setInvoice(null)
    } finally {
      setLoadingInvoice(false)
    }
  }

  const handleSubmit = async () => {
    if (!invoice) return
    if (!method) { setErrorMsg('Please select a payment method.'); return }
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) { setErrorMsg('Please enter a valid payment amount.'); return }
    const remaining = invoice.final_amount - (Number(invoice.total_paid_amount) || 0)
    if (parsed > remaining + 0.005) { setErrorMsg(`Amount exceeds remaining balance (${fmt(remaining)}).`); return }
    setErrorMsg('')
    setSettling(true)
    try {
      const res = await addInvoicePayment(invoice.id, {
        payment_method: method,
        payment_amount: parsed,
        ...(refNo && { payment_reference_no: refNo }),
        ...(remarks && { remarks }),
      })
      const updatedInvoice = res.data.data.invoice
      setInvoice(updatedInvoice)
      setOrders((prev) =>
        prev.map((o) => {
          if (o.Invoice && o.Invoice.id === updatedInvoice.id) {
            return { ...o, Invoice: updatedInvoice }
          }
          return o
        })
      )
      setMethod('')
      setAmount('')
      setRefNo('')
      setRemarks('')
      setSuccessMsg(res.data.message || 'Payment recorded successfully.')
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to record payment.')
    } finally {
      setSettling(false)
    }
  }

  const isPaid = invoice && (invoice.payment_status === 'paid' || invoice.payment_status === 'settled')
  const remaining = invoice ? invoice.final_amount - (Number(invoice.total_paid_amount) || 0) : 0
  const payments = invoice?.PaymentHistory || []

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 lg:gap-6">
      {/* Left: Invoice Search */}
      <div className="lg:col-span-2">
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search by Order # or Customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex gap-1.5 mb-3">
          {[
            { key: 'pending', label: 'Pending Balance' },
            { key: 'paid', label: 'Fully Paid' },
            { key: 'all', label: 'All Invoices' },
          ].map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilterType(btn.key)}
              className={`px-2.5 py-1 rounded text-2xs font-semibold transition-colors border ${
                filterType === btn.key
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-250 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
              {filtered.map((o) => {
                const badge = statusBadge(o.Invoice?.payment_status || 'unsettled')
                const total = o.Invoice?.final_amount || o.total_amount
                const paid = Number(o.Invoice?.total_paid_amount) || 0
                const balance = total - paid
                return (
                  <button
                    key={o.id}
                    onClick={() => selectOrder(o)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedOrder?.id === o.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">WS-{o.id}</span>
                      <span className={`text-4xs px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 font-medium">{storeMap[o.shop_id] || `Store #${o.shop_id}`}</p>
                    <div className="flex justify-between items-center text-3xs mt-1.5 pt-1.5 border-t border-gray-100">
                      <span className="text-gray-400">Total: {fmt(total)}</span>
                      {balance > 0.01 ? (
                        <span className="font-semibold text-orange-600">Owes: {fmt(balance)}</span>
                      ) : (
                        <span className="font-semibold text-green-600">Paid</span>
                      )}
                    </div>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No invoices found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Invoice Detail + Payment Form */}
      <div className="lg:col-span-3">
        {!selectedOrder && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-400 text-sm">Select an invoice from the left to record a payment</p>
          </div>
        )}

        {selectedOrder && loadingInvoice && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-400">Loading invoice…</p>
          </div>
        )}

        {selectedOrder && !loadingInvoice && !invoice && (
          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-gray-500 text-sm">No invoice found for Order WS-{selectedOrder.id}.</p>
          </div>
        )}

        {selectedOrder && !loadingInvoice && invoice && (
          <div className="space-y-4">
            {/* Invoice Summary */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice #{invoice.id}</p>
                  <p className="font-semibold text-gray-900 mt-0.5">Order WS-{selectedOrder.id}</p>
                  <p className="text-xs text-gray-500">{storeMap[selectedOrder.shop_id] || `Store #${selectedOrder.shop_id}`}</p>
                </div>
                {invoice.pdf_url && (
                  <a href={invoice.pdf_url} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">
                    Open PDF
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Invoice Total</p>
                  <p className="font-bold text-gray-900 text-sm">{fmt(invoice.final_amount)}</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Total Paid</p>
                  <p className="font-bold text-green-700 text-sm">{fmt(invoice.total_paid_amount || 0)}</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${isPaid ? 'bg-green-50' : 'bg-orange-50'}`}>
                  <p className="text-xs text-gray-400 mb-1">Balance Due</p>
                  <p className={`font-bold text-sm ${isPaid ? 'text-green-700' : 'text-orange-600'}`}>{fmt(remaining)}</p>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-700">Payment History ({payments.length})</p>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[420px]">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      {['Date', 'Method', 'Amount', 'Ref No', 'By', 'Remarks'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtTime(p.verified_at)}</td>
                        <td className="px-3 py-2.5 font-medium">{p.payment_method === 'MO' ? 'Money Order' : p.payment_method}</td>
                        <td className="px-3 py-2.5 font-semibold text-green-700">{fmt(p.payment_amount)}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-500">{p.payment_reference_no || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.VerifiedBy?.name || `User #${p.verified_by_user_id}` || '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 max-w-[100px] truncate">{p.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Record Payment Form */}
            {isPaid ? (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center">
                <p className="text-green-700 font-semibold text-sm">Invoice Fully Paid</p>
                <p className="text-green-600 text-xs mt-1">All {payments.length} payment{payments.length !== 1 ? 's' : ''} totalling {fmt(invoice.total_paid_amount)} have been recorded.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-gray-900 mb-3">
                  Record Payment
                  <span className="ml-2 text-xs font-normal text-gray-400">Remaining: {fmt(remaining)}</span>
                </h5>

                {successMsg && (
                  <div className="mb-3 px-3 py-2 rounded bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                    {successMsg}
                  </div>
                )}
                {errorMsg && (
                  <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Payment Method <span className="text-red-500">*</span></label>
                      <select value={method} onChange={(e) => { setMethod(e.target.value); setErrorMsg('') }}
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
                        value={amount} onChange={(e) => { setAmount(e.target.value); setErrorMsg('') }}
                        placeholder={`Max ${fmt(remaining)}`}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Payment Reference No</label>
                      <input type="text" value={refNo} onChange={(e) => setRefNo(e.target.value)}
                        placeholder="e.g. CHK-12345"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Remarks</label>
                      <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Any notes about this payment…"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                  </div>
                  <button onClick={handleSubmit} disabled={settling || !method || !amount}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 text-sm rounded-md transition-colors">
                    {settling ? 'Saving…' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
