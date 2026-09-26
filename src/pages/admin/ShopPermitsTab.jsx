import { useState, useEffect, useRef } from 'react'
import { getShopPermits, reviewPermit, uploadShopPermit } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import { Button } from '../../components/DesignSystem'

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const PERMIT_CONFIG = {
  'Seller Permit': { icon: '📄', slug: 'seller_permit' },
  'Tobacco License': { icon: '🚬', slug: 'tobacco_license' },
  'Business License': { icon: '🏢', slug: 'business_license' },
  'Resale Certificate': { icon: '📜', slug: 'resale_certificate' }
}

const toSlug = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export default function ShopPermitsTab({ shop }) {
  const [permits, setPermits] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  // Review modal state
  const [reviewing, setReviewing] = useState(null) // { permit, action: 'Approved'|'Rejected' }
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Direct replace / upload file input ref
  const [uploadingSlug, setUploadingSlug] = useState(null)
  const replaceFileInputRef = useRef(null)
  const [activeReplaceSlug, setActiveReplaceSlug] = useState(null)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const loadPermits = () => {
    if (!shop?.id) return
    setLoading(true)
    getShopPermits(shop.id)
      .then((res) => setPermits(res.data?.data?.permits || []))
      .catch(() => notify('Failed to load permits.', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPermits()
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
      const updated = res.data?.data?.permit
      setPermits((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      notify(`Permit ${reviewing.action.toLowerCase()} successfully.`)
      setReviewing(null)
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to review permit.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Trigger quick file upload/replacement for a specific permit slug
  const triggerQuickUpload = (slug) => {
    setActiveReplaceSlug(slug)
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = ''
      replaceFileInputRef.current.click()
    }
  }

  const handleReplaceFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeReplaceSlug || !shop?.id) return

    const formData = new FormData()
    formData.append('document', file)

    setUploadingSlug(activeReplaceSlug)
    try {
      await uploadShopPermit(shop.id, activeReplaceSlug, formData)
      notify('Permit uploaded/replaced successfully.')
      loadPermits()
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to upload permit document.', 'error')
    } finally {
      setUploadingSlug(null)
      setActiveReplaceSlug(null)
    }
  }

  if (loading) return <div className="py-8 text-center text-xs text-gray-400 font-medium">Loading permits…</div>

  // Collect all permit types to display (defaults + any already uploaded for this shop)
  const defaultTypes = ['Seller Permit', 'Tobacco License']
  const existingTypes = permits.map((p) => p.permit_type)
  const allDisplayTypes = Array.from(new Set([...defaultTypes, ...existingTypes]))

  const permitByType = {}
  permits.forEach((p) => {
    permitByType[p.permit_type] = p
  })

  return (
    <div className="space-y-4 text-xs">
      {/* Hidden file input for upload/replace */}
      <input
        type="file"
        ref={replaceFileInputRef}
        onChange={handleReplaceFileChange}
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
      />

      {msg && (
        <div
          className={`rounded-lg px-3.5 py-2.5 text-xs font-medium ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Clean Header bar */}
      <div className="pb-2 border-b border-gray-150">
        <h4 className="font-bold text-gray-900 text-sm">Store Documents & Permits</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          View, upload, edit, or review permits for <strong className="text-gray-800">{shop?.shop_name}</strong>.
        </p>
      </div>

      {/* Permit Items List */}
      <div className="space-y-3">
        {allDisplayTypes.map((type) => {
          const permit = permitByType[type]
          const meta = PERMIT_CONFIG[type] || { icon: '📄', slug: toSlug(type) }
          const isUploading = uploadingSlug === meta.slug

          return (
            <div key={type} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="text-xs font-bold text-gray-900">{type}</span>
                </div>
                <div>
                  {permit ? (
                    <StatusBadge status={permit.status} type="approval" />
                  ) : (
                    <span className="text-3xs font-medium text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                      Not Uploaded
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="px-4 py-3">
                {!permit ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                    <p className="text-xs text-gray-400 italic">No document uploaded yet for this permit.</p>
                    <Button
                      variant="primary"
                      disabled={isUploading}
                      onClick={() => triggerQuickUpload(meta.slug)}
                      className="text-xs py-1 px-3 shrink-0"
                    >
                      {isUploading ? 'Uploading…' : `+ Upload ${type}`}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-gray-400 text-3xs uppercase font-semibold">File Name</span>
                        <p className="text-gray-800 font-semibold truncate max-w-sm mt-0.5" title={permit.original_file_name}>
                          {permit.original_file_name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-3xs uppercase font-semibold">Uploaded Date</span>
                        <p className="text-gray-700 font-medium mt-0.5">{fmtDate(permit.uploaded_at)}</p>
                      </div>
                    </div>

                    {permit.remarks && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700">
                        <span className="font-semibold text-3xs uppercase">Remarks:</span> {permit.remarks}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-gray-100">
                      <a
                        href={permit.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition-colors border border-indigo-200 inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>View Document</span>
                      </a>

                      <Button
                        variant="secondary"
                        disabled={isUploading}
                        onClick={() => triggerQuickUpload(meta.slug)}
                        className="text-xs py-1 px-3"
                      >
                        {isUploading ? 'Uploading…' : 'Edit / Replace'}
                      </Button>

                      {permit.status !== 'Approved' && (
                        <Button
                          variant="success"
                          onClick={() => openReview(permit, 'Approved')}
                          className="text-xs py-1 px-3"
                        >
                          Approve
                        </Button>
                      )}

                      {permit.status !== 'Rejected' && (
                        <Button
                          variant="danger"
                          onClick={() => openReview(permit, 'Rejected')}
                          className="text-xs py-1 px-3"
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Review Modal (Approve / Reject) */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">
                {reviewing.action === 'Approved' ? 'Approve Permit' : 'Reject Permit'}
              </h3>
              <button
                onClick={() => setReviewing(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4">
              <p className="text-xs text-gray-600">
                {reviewing.action === 'Approved' ? (
                  <>
                    Are you sure you want to approve <strong>{reviewing.permit.permit_type}</strong> for <strong>{shop?.shop_name}</strong>?
                  </>
                ) : (
                  <>
                    Reject <strong>{reviewing.permit.permit_type}</strong> for <strong>{shop?.shop_name}</strong>. Please provide a reason below.
                  </>
                )}
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Remarks {reviewing.action === 'Rejected' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required={reviewing.action === 'Rejected'}
                  placeholder={reviewing.action === 'Rejected' ? 'Reason for rejection…' : 'Optional notes…'}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setReviewing(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant={reviewing.action === 'Approved' ? 'success' : 'danger'}
                  type="submit"
                  disabled={submitting}
                  className="text-xs"
                >
                  {submitting ? 'Saving…' : reviewing.action === 'Approved' ? 'Approve' : 'Reject'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

