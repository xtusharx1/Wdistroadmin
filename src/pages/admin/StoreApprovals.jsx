import { useState, useEffect } from 'react'
import { getShops, approveShop, rejectShop, resetShopPassword, updateShop, deleteShop, getUsers, createAssignment } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import { PageLayout, PageHeader, Button, SearchBar, TableToolbar, FilterBar, DataTable, Dialog as Modal, ConfirmationDialog } from '../../components/DesignSystem'
import ShopPermitsTab from './ShopPermitsTab'

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected']

export default function StoreApprovals() {
  const [stores, setStores] = useState([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState(null)
  const [acting, setActing] = useState(null)
  const [resetFor, setResetFor] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [resetting, setResetting] = useState(false)

  const [deleteStoreTarget, setDeleteStoreTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

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
    seller_permit: '',
    tobacco_license: '',
    allow_explicit_products: false
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const [execs, setExecs] = useState([])
  const [approvingStore, setApprovingStore] = useState(null)
  const [selectedExecId, setSelectedExecId] = useState('')
  const [approving, setApproving] = useState(false)
  const [allowExplicit, setAllowExplicit] = useState(false)

  const [permitsFor, setPermitsFor] = useState(null)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
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

  const visible = (
    filter === 'All' ? sortedStores : sortedStores.filter((s) => s.approval_status === filter)
  ).filter((s) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      (s.shop_name || '').toLowerCase().includes(q) ||
      (s.owner_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.contact_details || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.state || '').toLowerCase().includes(q) ||
      (s.seller_permit || '').toLowerCase().includes(q) ||
      (s.tobacco_license || '').toLowerCase().includes(q)
    )
  })

  const handleApprovalConfirm = async (e) => {
    e.preventDefault()
    if (!approvingStore) return
    setApproving(true)
    try {
      const res = await approveShop(approvingStore.id, { allow_explicit_products: allowExplicit })
      const updatedShop = res.data?.data?.shop || {}

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
        prev.map((s) => (s.id === approvingStore.id ? { ...s, approval_status: 'Approved', approved: true, allow_explicit_products: allowExplicit, ...updatedShop } : s))
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

  const handleDeleteConfirm = async () => {
    if (!deleteStoreTarget) return
    setDeleting(true)
    try {
      await deleteShop(deleteStoreTarget.id)
      setStores((prev) => prev.filter((s) => s.id !== deleteStoreTarget.id))
      notify(`Store "${deleteStoreTarget.shop_name}" was permanently deleted.`)
      setDeleteStoreTarget(null)
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete store.', 'error')
    } finally {
      setDeleting(false)
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
      seller_permit: store.seller_permit || '',
      tobacco_license: store.tobacco_license || '',
      allow_explicit_products: store.allow_explicit_products === true
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

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

  const tableHeaders = [
    { label: 'S.No', width: '5%', align: 'center' },
    { label: 'Store Name', width: '25%' },
    { label: 'Seller Permit No.', width: '15%' },
    { label: 'Tobacco License No.', width: '15%' },
    { label: 'Status', width: '10%' },
    { label: 'Permit Files', width: '12%' },
    { label: 'Actions', width: '18%' }
  ]

  if (loading) return <div className="p-4 sm:p-6 text-xs text-gray-400">Loading stores…</div>

  return (
    <PageLayout className="max-w-none w-full px-4 sm:px-6 lg:px-8 space-y-5">
      <PageHeader
        title="Stores"
        subtitle={`${stores.filter(s => s.approval_status === 'Pending').length} pending review & approval`}
      />

      <TableToolbar>
        <FilterBar>
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'secondary'}
              onClick={() => setFilter(f)}
              className="py-1 px-3 text-xs"
            >
              {f}
              {f === 'Pending' && (
                <span className="ml-1.5 font-bold">({stores.filter((s) => s.approval_status === 'Pending').length})</span>
              )}
            </Button>
          ))}
        </FilterBar>
        <SearchBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by store name, email, city, permit..."
        />
      </TableToolbar>

      {msg && (
        <div
          className={`mb-4 rounded-lg px-4 py-2.5 text-xs font-medium ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Full-width, Naturally Distributed Admin Stores Table */}
      <DataTable
        headers={tableHeaders}
        empty={visible.length === 0}
      >
        {visible.map((s, index) => (
          <tr key={s.id} className="hover:bg-indigo-50/20 transition-colors border-b border-gray-150 last:border-b-0">
            {/* 1. S.No (5%) */}
            <td className="px-4 py-3 text-center text-gray-400 font-semibold align-middle whitespace-nowrap text-xs">
              {index + 1}
            </td>

            {/* 2. Store Name (25%) */}
            <td className="px-4 py-3 align-middle">
              <div className="font-bold text-gray-900 text-sm leading-snug" title={s.shop_name}>
                {s.shop_name}
              </div>
              <div className="text-xs text-gray-500 leading-tight mt-0.5" title={s.email}>
                {s.email || '—'}
              </div>
              <div
                className="text-xs text-gray-400 leading-tight mt-0.5"
                title={[s.contact_details, [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              >
                {[s.contact_details, [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}
              </div>
            </td>

            {/* 3. Seller Permit No. (15%) */}
            <td className="px-4 py-3 align-middle whitespace-nowrap">
              {s.seller_permit ? (
                <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-250 px-2.5 py-1 rounded-md inline-block">
                  {s.seller_permit}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">Not Uploaded</span>
              )}
            </td>

            {/* 4. Tobacco License No. (15%) */}
            <td className="px-4 py-3 align-middle whitespace-nowrap">
              {s.tobacco_license ? (
                <span className="font-mono text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md inline-block">
                  {s.tobacco_license}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">Not Uploaded</span>
              )}
            </td>

            {/* 5. Status (10%) */}
            <td className="px-4 py-3 align-middle whitespace-nowrap">
              <StatusBadge status={s.approval_status} type="approval" />
            </td>

            {/* 6. Permit Files (12%) */}
            <td className="px-4 py-3 align-middle whitespace-nowrap">
              <button
                type="button"
                onClick={() => setPermitsFor(s)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs"
                title="View and manage permit documents"
              >
                <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Permit Files</span>
              </button>
            </td>

            {/* 7. Actions (18% - Approve, Reject, Edit, Reset PW, Delete for rejected) */}
            <td className="px-4 py-3 align-middle whitespace-nowrap">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                {s.approval_status !== 'Approved' && s.approval_status !== 'Rejected' && (
                  <button
                    onClick={() => { setApprovingStore(s); setSelectedExecId(''); setAllowExplicit(s.allow_explicit_products === true) }}
                    disabled={acting === s.id}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs leading-none whitespace-nowrap"
                  >
                    Approve
                  </button>
                )}
                {s.approval_status !== 'Rejected' && (
                  <button
                    onClick={() => doReject(s)}
                    disabled={acting === s.id}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs leading-none whitespace-nowrap"
                  >
                    Reject
                  </button>
                )}
                <button
                  onClick={() => openEditModal(s)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-2xs leading-none whitespace-nowrap"
                >
                  Edit
                </button>
                <button
                  onClick={() => { setResetFor(s); setNewPw('') }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors leading-none whitespace-nowrap"
                >
                  Reset PW
                </button>
                {s.approval_status === 'Rejected' && (
                  <button
                    onClick={() => setDeleteStoreTarget(s)}
                    disabled={acting === s.id}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs leading-none whitespace-nowrap"
                    title="Permanently delete this rejected store"
                  >
                    Delete
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* Edit Store Modal */}
      <Modal open={!!editStore} onClose={() => setEditStore(null)} title={`Edit Store — ${editStore?.shop_name}`}>
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Store Name *</label>
              <input
                type="text"
                value={editForm.shop_name}
                onChange={(e) => setEditForm({ ...editForm, shop_name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Name *</label>
              <input
                type="text"
                value={editForm.owner_name}
                onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Details *</label>
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={editForm.state}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zip</label>
              <input
                type="text"
                value={editForm.zip}
                onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Seller Permit</label>
              <input
                type="text"
                value={editForm.seller_permit}
                onChange={(e) => setEditForm({ ...editForm, seller_permit: e.target.value })}
                placeholder="e.g. SL-12345"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tobacco License</label>
              <input
                type="text"
                value={editForm.tobacco_license}
                onChange={(e) => setEditForm({ ...editForm, tobacco_license: e.target.value })}
                placeholder="e.g. TOB-99234"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="edit_allow_explicit_products"
              checked={editForm.allow_explicit_products}
              onChange={(e) => setEditForm({ ...editForm, allow_explicit_products: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="edit_allow_explicit_products" className="text-xs font-medium text-gray-700">
              Allow Explicit Products (Approved shops only)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditStore(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingEdit}
              className="text-xs"
            >
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset Password — ${resetFor?.shop_name}`}>
        <form onSubmit={doReset} className="space-y-4">
          <p className="text-xs text-gray-500">Enter a new password for <strong>{resetFor?.email}</strong>.</p>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={6}
              className={inputClass}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetFor(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={resetting}
              className="text-xs"
            >
              {resetting ? 'Resetting…' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Permits Management Modal */}
      <Modal
        open={!!permitsFor}
        onClose={() => setPermitsFor(null)}
        title={`Store Permits — ${permitsFor?.shop_name}`}
        size="lg"
      >
        {permitsFor && <ShopPermitsTab shop={permitsFor} />}
      </Modal>

      {/* Approve & Assign Store Modal */}
      <Modal open={!!approvingStore} onClose={() => setApprovingStore(null)} title="Approve Store">
        <form onSubmit={handleApprovalConfirm} className="space-y-4">
          <p className="text-xs text-gray-600">
            Are you sure you want to approve store <strong className="text-gray-900">{approvingStore?.shop_name}</strong>?
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Assign to Sales Agent (Optional)
            </label>
            <select
              value={selectedExecId}
              onChange={(e) => setSelectedExecId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select Sales Agent...</option>
              {execs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
            <p className="text-3xs text-gray-400 mt-1">
              Select an agent to assign this store immediately upon approval.
            </p>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="approve_allow_explicit_products"
              checked={allowExplicit}
              onChange={(e) => setAllowExplicit(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="approve_allow_explicit_products" className="text-xs font-medium text-gray-700">
              Allow Explicit Products for this store
            </label>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <Button
              type="submit"
              variant="success"
              disabled={approving || !selectedExecId}
              className="w-full text-xs py-2 justify-center"
            >
              {approving ? 'Processing...' : 'Approve & Assign Agent'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={approving}
              onClick={async () => {
                setApproving(true)
                try {
                  const res = await approveShop(approvingStore.id, { allow_explicit_products: allowExplicit })
                  const updatedShop = res.data?.data?.shop || {}
                  setStores((prev) =>
                    prev.map((s) => (s.id === approvingStore.id ? { ...s, approval_status: 'Approved', approved: true, allow_explicit_products: allowExplicit, ...updatedShop } : s))
                  )
                  notify('Store approved.')
                  setApprovingStore(null)
                } catch (err) {
                  notify(err.response?.data?.message || 'Failed to approve store.', 'error')
                } finally {
                  setApproving(false)
                }
              }}
              className="w-full text-xs py-2 justify-center"
            >
              {approving ? 'Processing...' : 'Approve without Agent (Skip)'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setApprovingStore(null)}
              className="w-full text-xs py-2 justify-center"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Permanently Delete Rejected Store Confirmation Dialog */}
      <ConfirmationDialog
        open={!!deleteStoreTarget}
        onClose={() => setDeleteStoreTarget(null)}
        title={`Delete Rejected Store — ${deleteStoreTarget?.shop_name}`}
        message={`Are you sure you want to permanently delete this rejected store account (${deleteStoreTarget?.shop_name})? This action cannot be undone and will permanently remove all associated permits and store records.`}
        onConfirm={handleDeleteConfirm}
        confirmText="Permanently Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </PageLayout>
  )
}


