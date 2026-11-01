import { useState } from 'react'
import { Dialog as Modal } from './DesignSystem'
import { changeOrderStore } from '../api'

export default function ChangeStoreDialog({
  open,
  orderId,
  currentShopId,
  currentShopName,
  approvedStores = [],
  storeMap = {},
  onClose,
  onSuccess,
}) {
  const [targetShopId, setTargetShopId] = useState('')
  const [step, setStep] = useState('select') // 'select' | 'confirm'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const targetShopName = storeMap[targetShopId] || approvedStores.find((s) => s.id === Number(targetShopId))?.shop_name || `Store #${targetShopId}`

  const handleProceedToConfirm = () => {
    if (!targetShopId || Number(targetShopId) === Number(currentShopId)) return
    setError(null)
    setStep('confirm')
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await changeOrderStore(orderId, Number(targetShopId))
      const updatedOrder = res.data?.data?.order
      const message = res.data?.message || 'Store changed successfully.'
      const pdfFailed = res.data?.data?.invoice_pdf_failed
      onSuccess?.(updatedOrder, message, pdfFailed)
      onClose?.()
    } catch (err) {
      setSaving(false)
      setError(err.response?.data?.message || 'Failed to change store. Please try again.')
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={`Change Store — Order WS-${orderId}`} size="md">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-red-800">Cannot Change Store</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {step === 'select' ? (
          <>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1 text-xs">
              <span className="text-gray-500 uppercase tracking-wide font-medium">Currently Assigned Store:</span>
              <p className="font-bold text-gray-900 text-sm">{currentShopName}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                Select New Destination Store <span className="text-red-500">*</span>
              </label>
              <select
                value={targetShopId}
                onChange={(e) => {
                  setTargetShopId(e.target.value)
                  setError(null)
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Choose an approved store --</option>
                {approvedStores
                  .filter((s) => s.id !== Number(currentShopId))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shop_name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Only approved stores can receive existing orders.
              </p>
            </div>

            <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs text-indigo-900 space-y-1">
              <p className="font-semibold text-indigo-950">Store Transfer Details:</p>
              <ul className="list-disc list-inside text-indigo-800/90 space-y-0.5">
                <li>Order ID, ordered items, and payment history remain intact.</li>
                <li>Receivables and ledger balances will move to the new store.</li>
                <li>The invoice PDF will be regenerated with the new store's billing address.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetShopId || Number(targetShopId) === Number(currentShopId)}
                onClick={handleProceedToConfirm}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
              >
                Continue ›
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirm Store Transfer
              </div>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                Please confirm that you want to move <strong>Order WS-{orderId}</strong> to the new store:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Current Store</span>
                  <span className="font-semibold text-gray-800">{currentShopName}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-300 shadow-2xs">
                  <span className="text-indigo-600 block text-[10px] uppercase font-bold">New Destination Store</span>
                  <span className="font-bold text-indigo-900">{targetShopName}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setError(null)
                  setStep('select')
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-colors"
              >
                ‹ Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Moving Store…
                    </>
                  ) : (
                    'Confirm & Move Store'
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
