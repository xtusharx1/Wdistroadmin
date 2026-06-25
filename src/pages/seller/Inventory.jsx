import { useState, useEffect } from 'react'
import { getProducts, updateStock } from '../../api'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`

function StockRow({ product, sNo, onSaved }) {
  const [qty, setQty] = useState(product.stock_quantity)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setQty(product.stock_quantity)
  }, [product.stock_quantity])

  const changed = qty !== product.stock_quantity

  const save = async () => {
    setSaving(true)
    try {
      await updateStock(product.id, qty)
      onSaved(product.id, qty)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setQty(product.stock_quantity)
    } finally {
      setSaving(false)
    }
  }

  const stockColor = (q) =>
    q === 0
      ? 'bg-red-50 border-red-300 text-red-700'
      : q < 10
      ? 'bg-amber-50 border-amber-300 text-amber-700'
      : 'bg-white border-gray-300 text-gray-900'

  const rowHighlight = (q) =>
    q === 0
      ? 'bg-red-50/70 hover:bg-red-100/70 transition-colors'
      : q < 10
      ? 'bg-amber-50/70 hover:bg-amber-100/70 transition-colors'
      : 'hover:bg-gray-50'

  return (
    <tr className={rowHighlight(qty)}>
      <td className="px-4 py-3 text-gray-500 font-medium">{sNo}</td>
      <td className="px-4 py-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-8 h-8 object-cover rounded border border-gray-200" />
        ) : (
          <div className="w-8 h-8 rounded bg-gray-100" />
        )}
      </td>
      <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
      <td className="px-4 py-3 text-gray-500">{product.category}</td>
      <td className="px-4 py-3 text-gray-600">{fmt(product.price)}</td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className={`w-20 border rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${stockColor(qty)}`}
        />
      </td>
      <td className="px-4 py-3">
        {saved ? (
          <span className="text-xs text-green-600 font-medium">Saved ✓</span>
        ) : (
          <button
            onClick={save}
            disabled={!changed || saving}
            className="text-xs px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-colors"
          >
            {saving ? '…' : 'Save'}
          </button>
        )}
      </td>
    </tr>
  )
}

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [editedIds, setEditedIds] = useState(new Set())

  useEffect(() => {
    setEditedIds(new Set())
  }, [filter, search])

  useEffect(() => {
    getProducts({ page: 1, limit: 500 })
      .then((res) => setProducts(res.data.data.products || []))
      .finally(() => setLoading(false))
  }, [])

  const onSaved = (id, newQty) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stock_quantity: newQty } : p))
    )
    setEditedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const visible = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    if (editedIds.has(p.id)) return true
    if (filter === 'Low Stock' && !(p.stock_quantity > 0 && p.stock_quantity < 10)) return false
    if (filter === 'Out of Stock' && p.stock_quantity !== 0) return false
    return true
  })

  const outOf = products.filter((p) => p.stock_quantity === 0).length
  const low = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 10).length

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Inventory / Stock</h2>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
        />
      </div>

      {(outOf > 0 || low > 0) && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {outOf > 0 && <span><strong>{outOf}</strong> out of stock. </span>}
          {low > 0 && <span><strong>{low}</strong> running low (&lt;10 units).</span>}
        </div>
      )}

      <div className="flex gap-1 mb-4">
        {['All', 'Low Stock', 'Out of Stock'].map((f) => (
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
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['S.No', 'Image', 'Name', 'Category', 'Price', 'Stock Qty', 'Save'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((p, index) => (
              <StockRow key={p.id} product={p} sNo={index + 1} onSaved={onSaved} />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No products found</p>
        )}
      </div>
    </div>
  )
}
