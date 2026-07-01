import { useState, useEffect, useCallback, useRef } from 'react'
import { getFeaturedProducts, getProducts, updateProduct } from '../../api'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

export default function FeaturedProducts() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(new Set()) // product ids to add
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  // Inline order editing
  const [editingOrder, setEditingOrder] = useState(null) // { id, value }
  const [savingOrder, setSavingOrder] = useState(null)

  const debounceRef = useRef(null)

  const loadFeatured = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getFeaturedProducts()
      setFeatured(res.data.data.products)
    } catch {
      setError('Failed to load featured products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFeatured() }, [loadFeatured])

  // Debounced product search inside the dialog
  useEffect(() => {
    if (!addOpen) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await getProducts({ search: searchQuery, limit: 30, page: 1 })
        setSearchResults(res.data.data.products)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, addOpen])

  const openAddDialog = () => {
    setSelected(new Set())
    setSearchQuery('')
    setSearchResults([])
    setAddError(null)
    setAddOpen(true)
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAddFeatured = async () => {
    if (selected.size === 0) return
    setAdding(true)
    setAddError(null)
    try {
      await Promise.all([...selected].map(id => updateProduct(id, { is_featured: true })))
      setAddOpen(false)
      await loadFeatured()
    } catch {
      setAddError('Failed to add selected products. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    try {
      await updateProduct(id, { is_featured: false, featured_order: null })
      await loadFeatured()
    } catch {
      setError('Failed to remove product from featured.')
    }
  }

  const startEditOrder = (product) => {
    setEditingOrder({ id: product.id, value: product.featured_order !== null && product.featured_order !== undefined ? String(product.featured_order) : '' })
  }

  const handleSaveOrder = async (id) => {
    if (!editingOrder) return
    const raw = editingOrder.value.trim()
    const parsed = raw === '' ? null : parseInt(raw, 10)
    if (raw !== '' && (isNaN(parsed) || parsed < 1)) {
      setEditingOrder(prev => ({ ...prev, value: raw }))
      return
    }
    setSavingOrder(id)
    try {
      await updateProduct(id, { featured_order: parsed })
      setEditingOrder(null)
      await loadFeatured()
    } catch {
      setError('Failed to update display order.')
    } finally {
      setSavingOrder(null)
    }
  }

  const featuredIds = new Set(featured.map(p => p.id))

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Featured Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Products highlighted on the mobile app home page.
          </p>
        </div>
        <button
          onClick={openAddDialog}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors self-start sm:self-auto"
        >
          + Add Featured Product
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Featured Products Table */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Loading featured products…</div>
      ) : featured.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm font-medium text-gray-500">No featured products yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Featured Product" to get started.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm" style={{ minWidth: '700px' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Display Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">Image</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Clearance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {featured.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  {/* Display Order — inline editable */}
                  <td className="px-4 py-3">
                    {editingOrder?.id === product.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          value={editingOrder.value}
                          onChange={e => setEditingOrder(prev => ({ ...prev, value: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveOrder(product.id)
                            if (e.key === 'Escape') setEditingOrder(null)
                          }}
                          className="w-16 border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveOrder(product.id)}
                          disabled={savingOrder === product.id}
                          className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {savingOrder === product.id ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingOrder(null)}
                          className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditOrder(product)}
                        className="flex items-center gap-1.5 group"
                        title="Click to edit display order"
                      >
                        <span className="font-semibold text-gray-700">
                          {product.featured_order !== null && product.featured_order !== undefined ? product.featured_order : '—'}
                        </span>
                        <span className="text-gray-300 group-hover:text-indigo-500 text-xs">✎</span>
                      </button>
                    )}
                  </td>

                  {/* Image */}
                  <td className="px-4 py-3">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-md border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-indigo-400">
                          {product.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 line-clamp-2">{product.name}</span>
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3 text-gray-500">{product.sku_id || '—'}</td>

                  {/* Category */}
                  <td className="px-4 py-3 text-gray-500">{product.sub_category}</td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(product.price)}</td>

                  {/* Clearance Price */}
                  <td className="px-4 py-3 text-right">
                    {product.is_clearance && product.clearance_price ? (
                      <span className="text-orange-600 font-semibold">{fmt(product.clearance_price)}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3 text-right">
                    <span className={product.stock_quantity === 0 ? 'text-red-600 font-semibold' : product.stock_quantity < 10 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                      {product.stock_quantity}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(product.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Featured Product Dialog */}
      {addOpen && (
        <Modal onClose={() => setAddOpen(false)}>
          <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-base font-bold text-gray-900">Add Featured Product</h2>
              <span className="text-xs text-gray-400">{selected.size} selected</span>
            </div>

            <input
              type="text"
              placeholder="Search products by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`${input} mb-3 shrink-0`}
              autoFocus
            />

            {addError && (
              <p className="mb-2 text-xs text-red-600 shrink-0">{addError}</p>
            )}

            {/* Results */}
            <div className="overflow-y-auto flex-1 border border-gray-200 rounded-md divide-y divide-gray-100">
              {searching ? (
                <p className="text-center text-sm text-gray-400 py-6">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">
                  {searchQuery ? 'No products found.' : 'Type to search products.'}
                </p>
              ) : (
                searchResults.map(product => {
                  const alreadyFeatured = featuredIds.has(product.id)
                  const isSelected = selected.has(product.id)
                  return (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                        alreadyFeatured ? 'opacity-40 cursor-not-allowed bg-gray-50' : isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyFeatured}
                        onChange={() => !alreadyFeatured && toggleSelect(product.id)}
                        className="accent-indigo-600"
                      />
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-9 h-9 rounded object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-indigo-400">{product.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                        <p className="text-xs text-gray-400">{product.sub_category} · {product.is_clearance ? `${fmt(product.clearance_price)} clearance` : fmt(product.price)}</p>
                      </div>
                      {alreadyFeatured && (
                        <span className="text-xs text-indigo-500 font-medium shrink-0">Featured</span>
                      )}
                    </label>
                  )
                })
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4 shrink-0">
              <button
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFeatured}
                disabled={selected.size === 0 || adding}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding…' : `Add ${selected.size > 0 ? `(${selected.size})` : ''}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
