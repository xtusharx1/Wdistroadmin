import { useState, useEffect, useMemo } from 'react'
import { getOrderReturns, createOrderReturn, generateCreditNotePdf } from '../../api'
import { Button, Dialog, Field } from '../../components/DesignSystem'
import { fmtDate } from '../../utils/date'
import { invoiceBalance } from '../../utils/invoice'

const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
// Works over plain http too (crypto.randomUUID needs a secure context)
const newRequestKey = () => `ret-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ReturnItemsModal({ order, storeName, onClose, onSaved }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [qty, setQty] = useState({})
  const [reason, setReason] = useState('')
  const [returnDate, setReturnDate] = useState(todayLocal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [itemErrors, setItemErrors] = useState([])
  const [requestKey] = useState(newRequestKey)

  useEffect(() => {
    getOrderReturns(order.id)
      .then((res) => setData(res.data.data))
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load order items.'))
      .finally(() => setLoading(false))
  }, [order.id])

  const lines = useMemo(() => (data?.items || []).map((item) => {
    const raw = qty[item.order_item_id]
    const q = raw === undefined || raw === '' ? 0 : Number(raw)
    const valid = Number.isInteger(q) && q >= 0 && q <= item.eligible_qty
    return { ...item, q, valid, credit: valid ? round2(item.unit_price * q) : 0 }
  }), [data, qty])

  const selected = lines.filter((l) => l.q > 0)
  const hasInvalid = lines.some((l) => !l.valid)
  const total = round2(selected.reduce((s, l) => s + l.credit, 0))
  const balanceBefore = invoiceBalance(data?.invoice)
  const balanceAfter = Math.max(0, round2(balanceBefore - total))
  const excessCredit = Math.max(0, round2(total - balanceBefore))

  const submit = async () => {
    if (saving || selected.length === 0 || hasInvalid) return
    setSaving(true)
    setError('')
    setItemErrors([])
    try {
      const res = await createOrderReturn(order.id, {
        items: selected.map((l) => ({ order_item_id: l.order_item_id, quantity: l.q })),
        reason: reason.trim() || undefined,
        // Today means "now"; another day is sent as local noon of that day
        return_date: returnDate && returnDate !== todayLocal() ? new Date(`${returnDate}T12:00:00`).toISOString() : undefined,
        request_key: requestKey,
      })
      onSaved(res.data)
    } catch (err) {
      const body = err.response?.data
      setError(body?.message || 'Failed to record the return.')
      setItemErrors(body?.item_errors || [])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? () => {} : onClose} title={`Return Items — Order WS-${order.id}`} size="xl">
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading order items…</p>
      ) : loadError ? (
        <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{loadError}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg text-xs">
            <div><p className="text-gray-400">Store</p><p className="font-medium text-gray-800">{storeName}</p></div>
            <div><p className="text-gray-400">Invoice Total</p><p className="font-medium text-gray-800">{money(data.invoice?.final_amount)}</p></div>
            <div><p className="text-gray-400">Paid / Credited</p><p className="font-medium text-gray-800">{money(data.invoice?.total_paid_amount)} / {money(data.invoice?.total_credited_amount)}</p></div>
            <div><p className="text-gray-400">Balance Due</p><p className="font-medium text-gray-800">{money(balanceBefore)}</p></div>
          </div>

          {!data.can_return && (
            <div className="px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">{data.blocked_reason}</div>
          )}
          {error && (
            <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
              {itemErrors.length > 1 && <ul className="list-disc ml-4 mt-1">{itemErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Product', 'Unit Price', 'Ordered', 'Returned', 'Eligible', 'Return Qty', 'Credit'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => (
                  <tr key={l.order_item_id} className={l.eligible_qty === 0 ? 'text-gray-400' : ''}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-800">{l.product_name}</p>
                      {l.sku_id && <p className="text-3xs text-gray-400 font-mono">{l.sku_id}</p>}
                    </td>
                    <td className="px-3 py-2.5">{money(l.unit_price)}</td>
                    <td className="px-3 py-2.5">{l.ordered_qty}</td>
                    <td className="px-3 py-2.5">{l.returned_qty}</td>
                    <td className="px-3 py-2.5 font-medium">{l.eligible_qty}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number" min="0" max={l.eligible_qty} step="1"
                        value={qty[l.order_item_id] ?? ''}
                        placeholder="0"
                        disabled={l.eligible_qty === 0 || !data.can_return || saving}
                        onChange={(e) => { setQty((prev) => ({ ...prev, [l.order_item_id]: e.target.value })); setError('') }}
                        aria-label={`Return quantity for ${l.product_name}`}
                        className={`w-20 border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 ${l.valid ? 'border-gray-300' : 'border-red-400'}`}
                      />
                      {!l.valid && <p className="text-3xs text-red-600 mt-0.5">Max {l.eligible_qty}</p>}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800">{l.q > 0 && l.valid ? money(l.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Return Date">
              <input type="date" value={returnDate} max={todayLocal()} onChange={(e) => setReturnDate(e.target.value)}
                disabled={saving}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
            <Field label="Reason">
              <input type="text" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Damaged on arrival" disabled={saving}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </Field>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 space-y-0.5">
              <p className="text-2xs font-bold text-gray-500 uppercase tracking-wider">Credit Note Amount</p>
              <p className="text-xl font-bold text-indigo-700">{money(total)}</p>
              {selected.length > 0 && (
                <p>Balance due after credit: <span className="font-semibold text-gray-700">{money(balanceAfter)}</span>
                  {excessCredit > 0 && <span className="text-amber-700"> · {money(excessCredit)} exceeds the balance due</span>}
                </p>
              )}
              <p className="text-3xs text-gray-400">Returned items are not added back to inventory.</p>
            </div>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving || selected.length === 0 || hasInvalid || !data.can_return}>
                {saving ? 'Issuing…' : 'Issue Credit Note'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export function ReturnsHistory({ orderId, refreshKey, canProcess, onNotify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState(null)

  const load = () => {
    setLoading(true)
    getOrderReturns(orderId)
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }
  useEffect(load, [orderId, refreshKey])

  const regenerate = async (cn) => {
    setGeneratingId(cn.id)
    try {
      await generateCreditNotePdf(cn.id)
      onNotify?.('Credit note PDF generated.')
      load()
    } catch (err) {
      onNotify?.(err.response?.data?.message || 'Failed to generate credit note PDF.', 'error')
    } finally {
      setGeneratingId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading returns…</p>
  if (!data) return <p className="text-sm text-gray-400 py-8 text-center">Could not load returns.</p>

  const { invoice, returns } = data
  return (
    <div className="space-y-4">
      {invoice && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg text-xs">
          <div><p className="text-gray-400">Invoice Total</p><p className="font-medium text-gray-800">{money(invoice.final_amount)}</p></div>
          <div><p className="text-gray-400">Paid</p><p className="font-medium text-green-700">{money(invoice.total_paid_amount)}</p></div>
          <div><p className="text-gray-400">Credited</p><p className="font-medium text-indigo-700">{money(invoice.total_credited_amount)}</p></div>
          <div><p className="text-gray-400">Balance Due</p><p className="font-medium text-gray-800">{money(invoiceBalance(invoice))}</p></div>
        </div>
      )}
      {returns.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No returns recorded for this order.</p>
      ) : returns.map((r) => (
        <div key={r.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <div className="text-xs">
              <p className="font-semibold text-gray-900">
                {r.CreditNote?.credit_note_number || `Return #${r.id}`}
                <span className="ml-2 inline-flex text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">{r.status}</span>
              </p>
              <p className="text-gray-500 mt-0.5">
                Returned {fmtDate(r.return_date)} · Against INV-{r.order_id} · By {r.CreatedBy?.name || (r.created_by_user_id ? `User #${r.created_by_user_id}` : '—')}
              </p>
              {r.CreditNote?.usage_status && (
                <p className="text-gray-500 mt-0.5">
                  {r.CreditNote.usage_status} · Used {money(r.CreditNote.used_amount)} · Remaining <span className="font-semibold text-indigo-700">{money(r.CreditNote.remaining_amount)}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-indigo-700">{money(r.total_amount)}</span>
              {r.CreditNote?.pdf_url ? (
                <>
                  <a href={r.CreditNote.pdf_url} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors">View</a>
                  <a href={r.CreditNote.pdf_url} download={`${r.CreditNote.credit_note_number}.pdf`} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors">Download</a>
                </>
              ) : canProcess && r.CreditNote ? (
                <button onClick={() => regenerate(r.CreditNote)} disabled={generatingId === r.CreditNote.id}
                  className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition-colors">
                  {generatingId === r.CreditNote.id ? 'Generating…' : 'Generate PDF'}
                </button>
              ) : null}
            </div>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-gray-100">
              {r.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2 text-gray-800">{it.product_name}</td>
                  <td className="px-3 py-2 text-gray-500 text-right whitespace-nowrap">{it.quantity} × {money(it.unit_price)}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 text-right">{money(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.reason && <p className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">Reason: {r.reason}</p>}
        </div>
      ))}
    </div>
  )
}
