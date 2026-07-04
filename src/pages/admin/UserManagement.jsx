import { useState, useEffect } from 'react'
import { getUser } from '../../auth'
import { getUsers, createUser, activateUser, deactivateUser, resetPassword, updateUser } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import { PageLayout, PageHeader, Button, SearchBar, TableToolbar, FilterBar, DataTable, Dialog as Modal, Field } from '../../components/DesignSystem'

const ROLES = ['Admin', 'Sales Executive']
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')

const blank = { name: '', email: '', password: '', role: 'Admin', phone: '' }

export default function UserManagement() {
  const me = getUser()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [roleFilter, setRoleFilter] = useState('All')
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
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

  const visible = (
    roleFilter === 'All' ? users : users.filter((u) => u.role === roleFilter)
  ).filter((u) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    )
  })

  const handleOpenCreate = () => {
    setEditUser(null)
    setForm(blank)
    setCreateOpen(true)
  }

  const handleOpenEdit = (user) => {
    setEditUser(user)
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'Admin',
      phone: user.phone || ''
    })
    setCreateOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editUser) {
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role,
          phone: form.phone || null
        }
        if (form.password) {
          payload.password = form.password
        }
        const res = await updateUser(editUser.id, payload)
        const updated = res.data.data.user
        setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...updated } : u)))
        notify('User updated successfully.')
      } else {
        const res = await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
        })
        setUsers((prev) => [res.data.data.user, ...prev])
        notify('User created successfully.')
      }
      setCreateOpen(false)
      setForm(blank)
      setEditUser(null)
    } catch (err) {
      notify(err.response?.data?.message || 'Action failed.', 'error')
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

  if (loading) return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>

  return (
    <PageLayout>
      <PageHeader
        title="User Management"
        subtitle={`${users.length} total users`}
        action={
          <Button onClick={handleOpenCreate}>+ Create User</Button>
        }
      />

      <TableToolbar>
        <FilterBar>
          {['All', ...ROLES].map((r) => (
            <Button
              key={r}
              variant={roleFilter === r ? 'primary' : 'secondary'}
              onClick={() => setRoleFilter(r)}
              className="py-1 px-3"
            >
              {r}
            </Button>
          ))}
        </FilterBar>
        <SearchBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
        />
      </TableToolbar>

      <DataTable
        headers={['S.No', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Created', 'Actions']}
        empty={visible.length === 0}
      >
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
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <Button variant="warning" onClick={() => handleOpenEdit(u)} className="py-0.5 px-2 text-2xs">Edit</Button>
                      <Button
                        variant={u.is_active ? 'secondary' : 'success'}
                        disabled={u.id === me.id}
                        onClick={() => doToggle(u)}
                        className="py-0.5 px-2 text-2xs"
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="secondary" onClick={() => { setResetFor(u); setNewPw('') }} className="py-0.5 px-2 text-2xs">Reset PW</Button>
                    </div>
                  </td>
                </tr>
              ))}
      </DataTable>

      {/* Create / Edit User Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={editUser ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Field label={editUser ? 'Password (leave blank to keep unchanged)' : 'Password'} required={!editUser}>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editUser}
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
              {saving ? (editUser ? 'Saving…' : 'Creating…') : (editUser ? 'Save Changes' : 'Create User')}
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
    </PageLayout>
  )
}

const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
