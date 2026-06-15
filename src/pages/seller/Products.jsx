import { useState, useEffect, useCallback } from 'react'
import { getProducts, createProduct, updateProduct, deleteProduct, uploadImage } from '../../api'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

const blankForm = { name: '', sku_id: '', category: 'General', unit: '', price: '', stock_quantity: '', image_url: '' }

export default function Products() {
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const LIMIT = 15

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(
    (page = 1) => {
      setLoading(true)
      getProducts({
        page,
        limit: LIMIT,
        search: debouncedSearch || undefined
      })
        .then((res) => {
          setProducts(res.data.data.products || [])
          setPagination(res.data.data.pagination || { total: 0, page: 1, totalPages: 1 })
        })
        .finally(() => setLoading(false))
    },
    [debouncedSearch]
  )

  useEffect(() => { load(1) }, [load])

  const visible = products.filter((p) => {
    if (categoryFilter === 'All') return true
    return p.category === categoryFilter
  })

  const openCreate = () => {
    setEditing(null)
    setForm(blankForm)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name,
      sku_id: p.sku_id || '',
      category: p.category,
      unit: p.unit,
      price: String(p.price),
      stock_quantity: String(p.stock_quantity),
      image_url: p.image_url || '',
    })
    setModalOpen(true)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await uploadImage(fd)
      setForm((f) => ({ ...f, image_url: res.data.data.image_url }))
    } catch {
      notify('Image upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      sku_id: form.sku_id || undefined,
      category: form.category,
      unit: form.unit,
      price: parseFloat(form.price),
      stock_quantity: parseInt(form.stock_quantity, 10),
      image_url: form.image_url || undefined,
    }
    try {
      if (editing) {
        const res = await updateProduct(editing.id, payload)
        setProducts((prev) =>
          prev.map((p) => (p.id === editing.id ? res.data.data.product : p))
        )
        notify('Product updated.')
      } else {
        await createProduct(payload)
        load(1)
        notify('Product created.')
      }
      setModalOpen(false)
    } catch (err) {
      notify(err.response?.data?.message || 'Save failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(p.id)
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
      notify('Product deleted.')
    } catch (err) {
      notify(err.response?.data?.message || 'Delete failed.', 'error')
    }
  }

  const stockColor = (qty) =>
    qty === 0
      ? 'text-red-600 bg-red-50'
      : qty < 10
      ? 'text-amber-700 bg-amber-50'
      : 'text-green-700 bg-green-50'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Products</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
          />
          <button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            + Add Product
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {['All', 'General', 'Tobacco'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              categoryFilter === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
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
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['S.No', 'Image', 'SKU ID', 'Name', 'Category', 'Unit', 'Price', 'Stock', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((p, index) => {
                  const sNo = (pagination.page - 1) * LIMIT + index + 1;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 font-medium">{sNo}</td>
                      <td className="px-4 py-2.5">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-9 h-9 object-cover rounded-md border border-gray-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center text-gray-300 text-xs">N/A</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{p.sku_id || '—'}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{p.category}</td>
                      <td className="px-4 py-2.5 text-gray-500">{p.unit}</td>
                      <td className="px-4 py-2.5 font-medium">{fmt(p.price)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockColor(p.stock_quantity)}`}>
                          {p.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => doDelete(p)}
                            className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-10">No products found</p>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button
            onClick={() => load(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => load(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.name}` : 'Add Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={input}
              />
            </Field>
            <Field label="SKU ID">
              <input
                value={form.sku_id}
                onChange={(e) => setForm({ ...form, sku_id: e.target.value })}
                className={input}
                placeholder="e.g. SKU-1002"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" required>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
                className={input}
              >
                <option value="General">General</option>
                <option value="Tobacco">Tobacco</option>
              </select>
            </Field>
            <Field label="Unit" required>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                required
                placeholder="kg, piece, box…"
                className={input}
              />
            </Field>
            <Field label="Price ($)" required>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                className={input}
              />
            </Field>
            <Field label="Stock Qty" required>
              <input
                type="number"
                min="0"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                required
                className={input}
              />
            </Field>
          </div>
          <Field label="Product Image">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
            {form.image_url && !uploading && (
              <img src={form.image_url} alt="preview" className="mt-2 h-20 rounded-md border border-gray-200 object-cover" />
            )}
          </Field>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-md"
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
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
