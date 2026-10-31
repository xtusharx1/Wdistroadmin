import { useState, useEffect } from 'react'
import { getAvailableCreditNotes, applyCreditNote } from '../../api'
import { invoiceBalance } from '../../utils/invoice'

const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const newRequestKey = () => `cna-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

// Applies a store credit note to an invoice as a credit adjustment (separate from recording a payment)
export default function ApplyCreditNote({ invoice, onApplied, onCancel }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [number, setNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [requestKey, setRequestKey] = useState(newRequestKey)

  const outstanding = invoiceBalance(invoice)

  useEffect(() => {
    getAvailableCreditNotes(invoice.id)
      .then((res) => setNotes(res.data.data.credit_notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
  }, [invoice.id])

  const selected = notes.find((n) => n.credit_note_number === number.trim().toUpperCase())
  const maxApply = selected ? Math.min(selected.remaining_amount, outstanding) : outstanding

  const choose = (num) => {
    setNumber(num)
    setErrors({})
    setError('')
    const note = notes.find((n) => n.credit_note_number === num)
    if (note) setAmount(String(Math.min(note.remaining_amount, outstanding).toFixed(2)))
  }

  const submit = async () => {
    if (saving) return
    const e = {}
    if (!/^CN-\d+-\d+$/i.test(number.trim())) e.credit_note_number = 'Enter a credit note number like CN-12-1.'
    const amt = Number(amount)
    if (amount === '' || !Number.isFinite(amt) || amt <= 0) e.amount = 'Enter a positive amount.'
    else if (!/^\d+(\.\d{1,2})?$/.test(String(amount).trim())) e.amount = 'At most 2 decimal places.'
    else if (amt > maxApply + 0.005) e.amount = `Cannot exceed ${money(maxApply)}.`
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    setError('')
    try {
      const res = await applyCreditNote(invoice.id, { credit_note_number: number.trim().toUpperCase(), amount: amt, request_key: requestKey })
      setRequestKey(newRequestKey())
      onApplied(res.data)
    } catch (err) {
      const body = err.response?.data
      if (body?.errors) setErrors(body.errors)
      setError(body?.message || 'Failed to apply the credit note.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
      <p className="text-xs font-semibold text-gray-700">
        Apply Credit Note
        <span className="ml-2 font-normal text-gray-400">Outstanding: {money(outstanding)} · recorded as a credit adjustment, not a payment</span>
      </p>
      {error && <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>}
      {loading ? (
        <p className="text-xs text-gray-400">Loading this store's credit notes…</p>
      ) : notes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {notes.map((n) => (
            <button key={n.id} type="button" onClick={() => choose(n.credit_note_number)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${n.credit_note_number === number.trim().toUpperCase() ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              {n.credit_note_number} · {money(n.remaining_amount)} available
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">This store has no credit notes with credit left. You can still enter a number.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Credit Note Number <span className="text-red-500">*</span></label>
          <input type="text" value={number} onChange={(e) => { setNumber(e.target.value); setErrors({}); setError('') }}
            placeholder="CN-12-1" disabled={saving} aria-label="Credit note number"
            className={`w-full border rounded-md px-2 py-1.5 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.credit_note_number ? 'border-red-400' : 'border-gray-300'}`} />
          {selected && <p className="text-3xs text-gray-400 mt-0.5">{money(selected.remaining_amount)} of {money(selected.amount)} available · from {selected.invoice_number}</p>}
          {errors.credit_note_number && <p className="text-3xs text-red-600 mt-0.5">{errors.credit_note_number}</p>}
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Amount to Apply <span className="text-red-500">*</span></label>
          <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setErrors({}) }}
            placeholder={`Max ${money(maxApply)}`} disabled={saving} aria-label="Credit amount to apply"
            className={`w-full border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.amount ? 'border-red-400' : 'border-gray-300'}`} />
          {errors.amount && <p className="text-3xs text-red-600 mt-0.5">{errors.amount}</p>}
        </div>
      </div>
      {Number(amount) > 0 && (
        <p className="text-xs text-gray-500">Remaining payable after credit: <span className="font-semibold text-gray-800">{money(Math.max(0, outstanding - Number(amount)))}</span></p>
      )}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || !number || !amount}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-1.5 text-xs rounded-md transition-colors">
          {saving ? 'Applying…' : 'Apply Credit'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium py-1.5 rounded-md">
          Cancel
        </button>
      </div>
    </div>
  )
}
