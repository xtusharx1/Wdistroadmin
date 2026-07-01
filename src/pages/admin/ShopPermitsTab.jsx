import { useState, useEffect } from 'react'
import { getShopPermits, reviewPermit } from '../../api'
import StatusBadge from '../../components/StatusBadge'

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const PERMIT_LABELS = {
  'Seller Permit': { icon: '📄', color: 'indigo' },
  'Tobacco License': { icon: '🚬', color: 'purple' },
}

export default function ShopPermitsTab({ shop }) {
  const [permits, setPermits] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  // Review modal state
  const [reviewing, setReviewing] = useState(null) // { permit, action: 'Approved'|'Rejected' }
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  useEffect(() => {
    if (!shop?.id) return
    setLoading(true)
    getShopPermits(shop.id)
      .then((res) => setPermits(res.data.data.permits || []))
      .catch(() => notify('Failed to load permits.', 'error'))
      .finally(() => setLoading(false))
  }, [shop?.id])

  const openReview = (permit, action) => {
    setReviewing({ permit, action })
    setRemarks('')
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!reviewing) return
    if (reviewing.action === 'Rejected' && !remarks.trim()) {
      notify('Remarks are required when rejecting.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await reviewPermit(reviewing.permit.id, {
        status: reviewing.action,
        remarks: remarks.trim() || undefined
      })
      const updated = res.data.data.permit
      setPermits((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      notify(`Permit ${reviewing.action.toLowerCase()} successfully.`)
      setReviewing(null)
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to review permit.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading permits…</div>

  const allTypes = ['Seller Permit', 'Tobacco License']
  const permitByType = {}
  permits.forEach((p) => { permitByType[p.permit_type] = p })

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-md px-4 py-2.5 text-sm ${
          msg.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {msg.text}
        </div>
      )}

      {allTypes.map((type) => {
        const permit = permitByType[type]
        const meta = PERMIT_LABELS[type]

        return (
          <div key={type} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-base">{meta.icon}</span>
                <span className="text-sm font-semibold text-gray-800">{type}</span>
              </div>
              {permit ? (
                <StatusBadge status={permit.status} type="approval" />
              ) : (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not Uploaded</span>
              )}
            </div>

            {/* Body */}
            <div className="px-4 py-3">
              {!permit ? (
                <p className="text-sm text-gray-400 italic">No document uploaded by the shop yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">File:</span>{' '}
                      <span className="text-gray-800 font-medium">{permit.original_file_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Uploaded:</span>{' '}
                      <span className="text-gray-700">{fmtDate(permit.uploaded_at)}</span>
                    </div>
                  </div>

                  {permit.remarks && (
                    <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                      <span className="font-medium">Remarks:</span> {permit.remarks}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <a
                      href={permit.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors"
                    >
                      View Document ↗
                    </a>
                    {permit.status !== 'Approved' && (
                      <button
                        onClick={() => openReview(permit, 'Approved')}
                        className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {permit.status !== 'Rejected' && (
                      <button
                        onClick={() => openReview(permit, 'Rejected')}
                        className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Review Modal (inline) */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">
                {reviewing.action === 'Approved' ? 'Approve Permit' : 'Reject Permit'}
              </h3>
              <button
                onClick={() => setReviewing(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none w-6 h-6 flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleReviewSubmit} className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                {reviewing.action === 'Approved'
                  ? <>Approve <strong>{reviewing.permit.permit_type}</strong> for <strong>{shop?.shop_name}</strong>?</>
                  : <>Reject <strong>{reviewing.permit.permit_type}</strong> for <strong>{shop?.shop_name}</strong>. Please provide a reason.</>
                }
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks {reviewing.action === 'Rejected' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required={reviewing.action === 'Rejected'}
                  placeholder={reviewing.action === 'Rejected' ? 'Reason for rejection…' : 'Optional notes…'}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 text-white text-sm font-medium py-2 rounded-md disabled:opacity-60 transition-colors ${
                    reviewing.action === 'Approved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? 'Saving…' : reviewing.action === 'Approved' ? 'Approve' : 'Reject'}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewing(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
