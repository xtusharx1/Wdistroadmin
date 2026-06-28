import { useState, useEffect } from 'react'
import { getShops, approveShop, rejectShop, resetShopPassword, updateShop, getUsers, createAssignment } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected']

export default function StoreApprovals() {
  const [stores, setStores] = useState([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [acting, setActing] = useState(null)
  const [resetFor, setResetFor] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [resetting, setResetting] = useState(false)

  // Edit store state
  const [editStore, setEditStore] = useState(null)
  const [editForm, setEditForm] = useState({
    shop_name: '',
    owner_name: '',
    email: '',
    contact_details: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    seller_permit: ''
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Approval assignment states
  const [execs, setExecs] = useState([])
  const [approvingStore, setApprovingStore] = useState(null)
  const [selectedExecId, setSelectedExecId] = useState('')
  const [approving, setApproving] = useState(false)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  const fetchStores = () => {
    getShops()
      .then((res) => setStores(res.data.data.shops || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStores()
    getUsers()
      .then((res) => {
        setExecs((res.data.data.users || []).filter((u) => u.role === 'Sales Executive'))
      })
      .catch((err) => console.error('Failed to load users', err))
  }, [])

  const sortedStores = [...stores].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

  const visible =
    filter === 'All' ? sortedStores : sortedStores.filter((s) => s.approval_status === filter)

  const handleApprovalConfirm = async (e) => {
    e.preventDefault()
    if (!approvingStore) return
    setApproving(true)
    try {
      await approveShop(approvingStore.id)
      
      let assignedText = ''
      if (selectedExecId) {
        const exec = execs.find((u) => String(u.id) === String(selectedExecId))
        const todayStr = new Date().toISOString().split('T')[0]
        await createAssignment({
          sales_exec_id: Number(selectedExecId),
          shop_id: approvingStore.id,
          start_date: todayStr
        })
        if (exec) {
          assignedText = ` and assigned to ${exec.name}`
        }
      }

      setStores((prev) =>
        prev.map((s) => (s.id === approvingStore.id ? { ...s, approval_status: 'Approved', approved: true } : s))
      )
      notify(`Store approved${assignedText}.`)
      setApprovingStore(null)
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to approve store.', 'error')
    } finally {
      setApproving(false)
    }
  }

  const doReject = async (store) => {
    if (!confirm(`Reject "${store.shop_name}"?`)) return
    setActing(store.id)
    try {
      await rejectShop(store.id)
      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, approval_status: 'Rejected', approved: false } : s))
      )
      notify('Store rejected.')
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
      notify('Store password reset successfully.')
    } catch (err) {
      notify(err.response?.data?.message || 'Reset failed.', 'error')
    } finally {
      setResetting(false)
    }
  }

  const openEditModal = (store) => {
    setEditStore(store)
    setEditForm({
      shop_name: store.shop_name || '',
      owner_name: store.owner_name || '',
      email: store.email || '',
      contact_details: store.contact_details || '',
      address: store.address || '',
      city: store.city || '',
      state: store.state || '',
      zip: store.zip || '',
      seller_permit: store.seller_permit || ''
    })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const res = await updateShop(editStore.id, editForm)
      const updatedStore = res.data.data.shop
      setStores((prev) =>
        prev.map((s) => (s.id === editStore.id ? { ...s, ...updatedStore } : s))
      )
      setEditStore(null)
      notify('Store updated successfully.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update store.', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const [licenseFor, setLicenseFor] = useState(null)
  const [licForm, setLicForm] = useState({
    seller_permit: '',
    tobacco_license: ''
  })
  const [savingLic, setSavingLic] = useState(false)

  const openLicenseModal = (store) => {
    setLicenseFor(store)
    setLicForm({
      seller_permit: store.seller_permit || '',
      tobacco_license: store.tobacco_license || ''
    })
  }

  const handleLicenseSubmit = async (e) => {
    e.preventDefault()
    setSavingLic(true)
    try {
      const payload = {
        seller_permit: licForm.seller_permit,
        tobacco_license: licForm.tobacco_license || null
      }
      const res = await updateShop(licenseFor.id, payload)
      const updatedStore = res.data.data.shop
      setStores((prev) =>
        prev.map((s) => (s.id === licenseFor.id ? { ...s, ...updatedStore } : s))
      )
      setLicenseFor(null)
      notify('Licenses updated successfully.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update licenses.', 'error')
    } finally {
      setSavingLic(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Stores</h2>
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
                  ({stores.filter((s) => s.approval_status === 'Pending').length})
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
              {['S.No', 'Store Name', 'Owner', 'Contact', 'City / State', 'Seller Permit', 'Submitted', 'Status', 'Actions'].map(
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
                  <div>{s.shop_name}</div>
                  {s.tobacco_license && (
                    <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      Tobacco Lic: {s.tobacco_license}
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
                        onClick={() => { setApprovingStore(s); setSelectedExecId('') }}
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
                      onClick={() => openEditModal(s)}
                      className="text-xs px-2.5 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setResetFor(s); setNewPw('') }}
                      className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => openLicenseModal(s)}
                      className="text-xs px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors"
                    >
                      Licenses
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No stores in this category</p>
        )}
      </div>

      {/* Edit Store Modal */}
      <Modal open={!!editStore} onClose={() => setEditStore(null)} title={`Edit Store — ${editStore?.shop_name}`}>
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
              <input
                type="text"
                value={editForm.shop_name}
                onChange={(e) => setEditForm({ ...editForm, shop_name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
              <input
                type="text"
                value={editForm.owner_name}
                onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Details *</label>
              <input
                type="text"
                value={editForm.contact_details}
                onChange={(e) => setEditForm({ ...editForm, contact_details: e.target.value })}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={editForm.state}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
              <input
                type="text"
                value={editForm.zip}
                onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seller Permit *</label>
            <input
              type="text"
              value={editForm.seller_permit}
              onChange={(e) => setEditForm({ ...editForm, seller_permit: e.target.value })}
              required
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={savingEdit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md"
            >
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditStore(null)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

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

      {/* Licenses Modal */}
      <Modal open={!!licenseFor} onClose={() => setLicenseFor(null)} title={`Manage Licenses — ${licenseFor?.shop_name}`}>
        <form onSubmit={handleLicenseSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Seller Permit</label>
            <input
              type="text"
              value={licForm.seller_permit}
              onChange={(e) => setLicForm({ ...licForm, seller_permit: e.target.value })}
              required
              placeholder="e.g. SL-12345"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tobacco License</label>
            <input
              type="text"
              value={licForm.tobacco_license}
              onChange={(e) => setLicForm({ ...licForm, tobacco_license: e.target.value })}
              placeholder="e.g. TOB-99234 (Optional)"
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={savingLic}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md"
            >
              {savingLic ? 'Saving…' : 'Save Licenses'}
            </button>
            <button
              type="button"
              onClick={() => setLicenseFor(null)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve & Assign Store Modal */}
      <Modal open={!!approvingStore} onClose={() => setApprovingStore(null)} title="Approve Store">
        <form onSubmit={handleApprovalConfirm} className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to approve store <strong className="text-gray-900">{approvingStore?.shop_name}</strong>?
          </p>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Assign to Sales Agent (Optional)
            </label>
            <select
              value={selectedExecId}
              onChange={(e) => setSelectedExecId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Sales Agent...</option>
              {execs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Select an agent to assign this store immediately upon approval.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={approving || !selectedExecId}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-colors"
            >
              {approving ? 'Processing...' : 'Approve & Assign Agent'}
            </button>
            <button
              type="button"
              disabled={approving}
              onClick={async () => {
                setApproving(true)
                try {
                  await approveShop(approvingStore.id)
                  setStores((prev) =>
                    prev.map((s) => (s.id === approvingStore.id ? { ...s, approval_status: 'Approved', approved: true } : s))
                  )
                  notify('Store approved.')
                  setApprovingStore(null)
                } catch (err) {
                  notify(err.response?.data?.message || 'Failed to approve store.', 'error')
                } finally {
                  setApproving(false)
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md transition-colors"
            >
              {approving ? 'Processing...' : 'Approve without Agent (Skip)'}
            </button>
            <button
              type="button"
              onClick={() => setApprovingStore(null)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
