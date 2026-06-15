import { useState, useEffect } from 'react'
import { getShops, approveShop, rejectShop, resetShopPassword } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected']

export default function ShopApprovals() {
  const [shops, setShops] = useState([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [acting, setActing] = useState(null)
  const [resetFor, setResetFor] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [resetting, setResetting] = useState(false)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    getShops()
      .then((res) => setShops(res.data.data.shops || []))
      .finally(() => setLoading(false))
  }, [])

  const sortedShops = [...shops].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

  const visible =
    filter === 'All' ? sortedShops : sortedShops.filter((s) => s.approval_status === filter)

  const doApprove = async (shop) => {
    if (!confirm(`Approve "${shop.shop_name}"?`)) return
    setActing(shop.id)
    try {
      await approveShop(shop.id)
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, approval_status: 'Approved', approved: true } : s))
      )
      notify('Shop approved.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to approve.', 'error')
    } finally {
      setActing(null)
    }
  }

  const doReject = async (shop) => {
    if (!confirm(`Reject "${shop.shop_name}"?`)) return
    setActing(shop.id)
    try {
      await rejectShop(shop.id)
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, approval_status: 'Rejected', approved: false } : s))
      )
      notify('Shop rejected.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to reject.', 'error')
    } finally {
      setActing(null)
    }
  }

  const doReset = async (e) => {
    e.preventDefault()
    if (!newPw || newPw.length < 6) return notify('Password must be at least 6 characters.', 'error')
    setResetting(true)
    try {
      await resetShopPassword(resetFor.email, newPw)
      setResetFor(null)
      setNewPw('')
      notify('Shop password reset successfully.')
    } catch (err) {
      notify(err.response?.data?.message || 'Reset failed.', 'error')
    } finally {
      setResetting(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Shops</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
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
              {f === 'Pending' && (
                <span className="ml-1.5 text-xs">
                  ({shops.filter((s) => s.approval_status === 'Pending').length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-md px-4 py-2.5 text-sm ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Shop Name', 'Owner', 'Contact', 'City / State', 'Seller Permit', 'Submitted', 'Status', 'Actions'].map(
                (h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((s, index) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {s.shop_name}
                  {s.tobacco_license && (
                    <span className="ml-1.5 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                      Tobacco
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-700">{s.owner_name}</div>
                  <div className="text-xs text-gray-400">{s.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-500">{s.contact_details}</td>
                <td className="px-4 py-3 text-gray-500">
                  {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.seller_permit}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.approval_status} type="approval" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {s.approval_status !== 'Approved' && (
                      <button
                        onClick={() => doApprove(s)}
                        disabled={acting === s.id}
                        className="text-xs px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {s.approval_status !== 'Rejected' && (
                      <button
                        onClick={() => doReject(s)}
                        disabled={acting === s.id}
                        className="text-xs px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    )}
                    <button
                      onClick={() => { setResetFor(s); setNewPw('') }}
                      className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      Reset PW
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No shops in this category</p>
        )}
      </div>

      {/* Reset Password Modal */}
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset Password — ${resetFor?.shop_name}`}>
        <form onSubmit={doReset} className="space-y-4">
          <p className="text-sm text-gray-500">Enter a new password for {resetFor?.email}.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={resetting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md"
            >
              {resetting ? 'Resetting…' : 'Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => setResetFor(null)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
