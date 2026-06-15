import { useState, useEffect } from 'react'
import { getUser } from '../../auth'
import { getUsers, createUser, activateUser, deactivateUser, resetPassword } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const ROLES = ['Admin', 'Sales Executive']
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const blank = { name: '', email: '', password: '', role: 'Admin', phone: '' }

export default function UserManagement() {
  const me = getUser()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [roleFilter, setRoleFilter] = useState('All')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const [resetFor, setResetFor] = useState(null)
  const [newPw, setNewPw] = useState('')
  const [resetting, setResetting] = useState(false)

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    getUsers()
      .then((res) => setUsers(res.data.data.users || []))
      .finally(() => setLoading(false))
  }, [])

  const visible =
    roleFilter === 'All' ? users : users.filter((u) => u.role === roleFilter)

  const doCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        phone: form.phone || undefined,
      })
      setUsers((prev) => [res.data.data.user, ...prev])
      setCreateOpen(false)
      setForm(blank)
      notify('User created successfully.')
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to create user.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const doToggle = async (user) => {
    if (user.id === me.id) return notify('Cannot deactivate your own account.', 'error')
    const action = user.is_active ? deactivateUser : activateUser
    const label = user.is_active ? 'deactivate' : 'activate'
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} "${user.name}"?`)) return
    try {
      await action(user.id)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      )
      notify(`User ${label}d.`)
    } catch (err) {
      notify(err.response?.data?.message || 'Action failed.', 'error')
    }
  }

  const doReset = async (e) => {
    e.preventDefault()
    if (!newPw || newPw.length < 6) return notify('Password must be at least 6 characters.', 'error')
    setResetting(true)
    try {
      await resetPassword(resetFor.email, newPw)
      setResetFor(null)
      setNewPw('')
      notify('Password reset successfully.')
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
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          + Create User
        </button>
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

      <div className="flex gap-1 mb-4">
        {['All', ...ROLES].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              roleFilter === r
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((u, index) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.name}
                  {u.id === me.id && (
                    <span className="ml-1.5 text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">You</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{u.role}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.is_active} type="user" />
                </td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => doToggle(u)}
                      disabled={u.id === me.id}
                      className={`text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-40 ${
                        u.is_active
                          ? 'bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700'
                          : 'bg-green-50 hover:bg-green-100 text-green-700'
                      }`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => { setResetFor(u); setNewPw('') }}
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
          <p className="text-center text-gray-400 text-sm py-10">No users found</p>
        )}
      </div>

      {/* Create User Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User">
        <form onSubmit={doCreate} className="space-y-4">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={input}
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={input}
            />
          </Field>
          <Field label="Password" required>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className={input}
            />
          </Field>
          <Field label="Role" required>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={input}
            >
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={input}
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md"
            >
              {saving ? 'Creating…' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset Password — ${resetFor?.name}`}>
        <form onSubmit={doReset} className="space-y-4">
          <p className="text-sm text-gray-500">Enter a new password for {resetFor?.email}.</p>
          <Field label="New Password" required>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={6}
              className={input}
              autoFocus
            />
          </Field>
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

const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
