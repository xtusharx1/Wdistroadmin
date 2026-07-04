import { useState, useEffect } from 'react'
import { getAssignments, getUsers, getShops, createAssignment, endAssignment, updateAssignment, getIncentives } from '../../api'
import { PageLayout, PageHeader, Button, SearchBar, TableToolbar, FilterBar, DataTable, LoadingState, Dialog as Modal, Field } from '../../components/DesignSystem'
import StatusBadge from '../../components/StatusBadge'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—')
const today = () => new Date().toISOString().split('T')[0]

const BLANK_FORM = { sales_exec_id: '', shop_id: '', start_date: today(), end_date: '' }

export default function Assignments() {
  const [assignments, setAssignments] = useState([])
  const [execs, setExecs] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Active')
  const [createModal, setCreateModal] = useState(false)
  const [search, setSearch] = useState('')

  const [editAssignment, setEditAssignment] = useState(null)

  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [ending, setEnding] = useState(null)
  const [msg, setMsg] = useState(null)
  const [performance, setPerformance] = useState([])

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  const load = () =>
    Promise.all([getAssignments(), getUsers(), getShops(), getIncentives()]).then(
      ([aRes, uRes, sRes, pRes]) => {
        setAssignments(aRes.data.data.assignments || [])
        setExecs((uRes.data.data.users || []).filter((u) => u.role === 'Sales Executive'))
        setStores(sRes.data.data.shops || [])
        setPerformance(pRes.data.data.performance || [])
      }
    ).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditAssignment(null)
    setForm(BLANK_FORM)
    setCreateModal(true)
  }

  const openEdit = (a) => {
    setEditAssignment(a)
    setForm({
      sales_exec_id: String(a.sales_exec_id),
      shop_id: String(a.shop_id),
      start_date: a.start_date ? a.start_date.split('T')[0] : today(),
      end_date: a.end_date ? a.end_date.split('T')[0] : ''
    })
    setCreateModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.sales_exec_id || !form.shop_id || !form.start_date) return
    setSaving(true)
    try {
      const payload = {
        sales_exec_id: Number(form.sales_exec_id),
        shop_id: Number(form.shop_id),
        start_date: form.start_date,
        end_date: form.end_date || null
      }

      if (editAssignment) {
        await updateAssignment(editAssignment.id, payload)
        notify('Assignment updated successfully.')
      } else {
        await createAssignment(payload)
        notify('Assignment created.')
      }
      setCreateModal(false)
      load()
    } catch (err) {
      notify(err.response?.data?.message || 'Action failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const doEnd = async (a) => {
    if (!confirm(`End assignment for ${a.SalesExecutive?.name || `Exec #${a.sales_exec_id}`} → ${a.Shop?.shop_name || `Store #${a.shop_id}`}?`)) return
    setEnding(a.id)
    try {
      await endAssignment(a.id, { end_date: today() })
      notify('Assignment ended.')
      setAssignments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, end_date: today() } : x))
      )
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to end assignment.', 'error')
    } finally {
      setEnding(null)
    }
  }

  const visible = (
    filter === 'Active'
      ? assignments.filter((a) => !a.end_date)
      : filter === 'Historical'
      ? assignments.filter((a) => !!a.end_date)
      : assignments
  ).filter((a) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    const execName = a.SalesExec?.name?.toLowerCase() || ''
    const storeName = a.Shop?.name?.toLowerCase() || ''
    return execName.includes(q) || storeName.includes(q)
  })

  if (loading) return <LoadingState message="Loading assignments..." />

  return (
    <PageLayout>
      <PageHeader
        title="Sales Executive Assignments"
        subtitle={`${assignments.filter((a) => !a.end_date).length} active executive assignments`}
        action={
          <Button onClick={openCreate}>
            + Assign Store
          </Button>
        }
      />

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

      <TableToolbar>
        <FilterBar>
          {['Active', 'Historical', 'All'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'secondary'}
              onClick={() => setFilter(f)}
              className="py-1 px-3"
            >
              {f}
            </Button>
          ))}
        </FilterBar>
        <SearchBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by executive or store..."
        />
      </TableToolbar>

      <DataTable
        headers={['S.No', 'Sales Executive', 'Assigned Store', 'Start Date', 'End Date', 'Status', 'Actions']}
        empty={visible.length === 0}
      >
              {visible.map((a, index) => {
                const isActive = !a.end_date
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {a.SalesExecutive?.name || `Exec #${a.sales_exec_id}`}
                      </p>
                      {a.SalesExecutive?.email && (
                        <p className="text-xs text-gray-400 mt-0.5">{a.SalesExecutive.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{a.Shop?.shop_name || `Store #${a.shop_id}`}</p>
                      {(a.Shop?.city || a.Shop?.state) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[a.Shop.city, a.Shop.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(a.start_date)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(a.end_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={isActive ? 'active' : 'inactive'} type="user" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <Button
                          variant="outlined"
                          onClick={() => openEdit(a)}
                          className="py-1 px-2 text-2xs"
                        >
                          Edit
                        </Button>
                        {isActive && (
                          <Button
                            variant="danger"
                            onClick={() => doEnd(a)}
                            className="py-1 px-2 text-2xs"
                          >
                            End Assignment
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
            })}
          </DataTable>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No assignments found</p>
        )}

      {/* Create / Edit Assignment Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title={editAssignment ? 'Edit Store Assignment' : 'Assign Store to Sales Executive'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sales Executive</label>
            <select
              required
              value={form.sales_exec_id}
              onChange={(e) => setForm((f) => ({ ...f, sales_exec_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select Sales Executive…</option>
              {execs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
            {execs.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No active Sales Executives found. Create one in User Management first.</p>
            )}
          </div>

          {form.sales_exec_id && (() => {
            const activeStores = assignments
              .filter((a) => String(a.sales_exec_id) === String(form.sales_exec_id) && !a.end_date)
              .map((a) => a.Shop?.shop_name || `Store #${a.shop_id}`)

            const execPerf = performance.filter((p) => String(p.sales_exec?.id) === String(form.sales_exec_id))
            const totalSales = execPerf.reduce((sum, item) => sum + (item.order?.total_amount || 0), 0)
            const totalOrders = execPerf.length

            return (
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold text-indigo-900 uppercase tracking-wider text-[10px]">
                    Sales Agent Overview
                  </span>
                  <a
                    href={`/admin/sales-performance?execId=${form.sales_exec_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    View Overall Performance →
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white/60 rounded p-2 border border-indigo-50/50">
                    <p className="text-gray-500 font-medium">Total Sales</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                      ${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white/60 rounded p-2 border border-indigo-50/50">
                    <p className="text-gray-500 font-medium">Orders Driven</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{totalOrders}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-500 font-medium mb-1">Active Store Assignments ({activeStores.length})</p>
                  {activeStores.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {activeStores.map((store, i) => (
                        <span
                          key={i}
                          className="bg-indigo-100/60 text-indigo-800 px-2 py-0.5 rounded font-medium"
                        >
                          {store}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No active store assignments</p>
                  )}
                </div>
              </div>
            )
          })()}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Store</label>
            <select
              required
              value={form.shop_id}
              onChange={(e) => setForm((f) => ({ ...f, shop_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Select Store…</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name} {s.city ? `— ${s.city}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {editAssignment && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md transition-colors"
            >
              {saving ? 'Saving…' : (editAssignment ? 'Save Changes' : 'Create Assignment')}
            </button>
            <button
              type="button"
              onClick={() => setCreateModal(false)}
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
