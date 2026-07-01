import { useState, useEffect, useCallback, useRef } from 'react'
import { getFeaturedProducts, getProducts, updateProduct } from '../../api'
import Modal from '../../components/Modal'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

export default function FeaturedProducts() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [removing, setRemoving] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

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
    setRemoving(id)
    try {
      await updateProduct(id, { is_featured: false })
      await loadFeatured()
    } catch {
      setError('Failed to remove product from featured.')
    } finally {
      setRemoving(null)
    }
  }

  const featuredIds = new Set(featured.map(p => p.id))

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-gray-900">Featured Products</h1>
            {!loading && featured.length > 0 && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                {featured.length}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Products highlighted on the mobile app home page.</p>
        </div>
        <button
          onClick={openAddDialog}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Featured Product
        </button>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {/* Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
              <div className="h-44 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-4/5" />
                <div className="h-4 bg-gray-100 rounded w-3/5" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : featured.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-600">No featured products yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Add products to feature them on the mobile app home screen.</p>
          <button
            onClick={openAddDialog}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Add Featured Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {featured.map(product => (
            <div key={product.id} className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all duration-200">
              {/* Image */}
              <div className="relative h-44 bg-gray-50">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100">
                    <span className="text-4xl font-black text-indigo-200 select-none">
                      {product.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                  {product.is_clearance && (
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-md shadow-sm tracking-wide">
                      SALE
                    </span>
                  )}
                  {!product.is_active && (
                    <span className="px-2 py-0.5 bg-gray-700/80 text-white text-[10px] font-bold rounded-md shadow-sm tracking-wide">
                      INACTIVE
                    </span>
                  )}
                </div>

                {/* Remove on hover */}
                <button
                  onClick={() => handleRemove(product.id)}
                  disabled={removing === product.id}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white shadow-md text-gray-400 hover:text-red-500 hover:shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50"
                  title="Remove from featured"
                >
                  {removing === product.id ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">{product.sub_category}</p>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-3">{product.name}</p>

                {/* Price row */}
                <div className="flex items-end gap-2 mb-3">
                  {product.is_clearance && product.clearance_price ? (
                    <>
                      <span className="text-base font-bold text-orange-600">{fmt(product.clearance_price)}</span>
                      <span className="text-xs text-gray-400 line-through mb-0.5">{fmt(product.price)}</span>
                    </>
                  ) : (
                    <span className="text-base font-bold text-gray-900">{fmt(product.price)}</span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>{product.sku_id || <span className="italic">No SKU</span>}</span>
                  <span className={
                    product.stock_quantity === 0 ? 'text-red-500 font-medium' :
                    product.stock_quantity < 10 ? 'text-amber-500 font-medium' :
                    'text-gray-400'
                  }>
                    {product.stock_quantity === 0 ? 'Out of stock' : `${product.stock_quantity} in stock`}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${product.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${product.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleRemove(product.id)}
                    disabled={removing === product.id}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-40"
                  >
                    {removing === product.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Featured Product Dialog */}
      {addOpen && (
        <Modal open={true} onClose={() => setAddOpen(false)}>
          <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-base font-bold text-gray-900">Add Featured Product</h2>
              {selected.size > 0 && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                  {selected.size} selected
                </span>
              )}
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

            <div className="overflow-y-auto flex-1 border border-gray-200 rounded-lg divide-y divide-gray-100">
              {searching ? (
                <p className="text-center text-sm text-gray-400 py-8">Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {searchQuery ? 'No products found.' : 'Type to search products.'}
                </p>
              ) : (
                searchResults.map(product => {
                  const alreadyFeatured = featuredIds.has(product.id)
                  const isSelected = selected.has(product.id)
                  return (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                        alreadyFeatured ? 'opacity-40 cursor-not-allowed bg-gray-50' : isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={alreadyFeatured}
                        onChange={() => !alreadyFeatured && toggleSelect(product.id)}
                        className="accent-indigo-600 w-4 h-4 shrink-0"
                      />
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-indigo-400">{product.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {product.sub_category}
                          <span className="mx-1.5">·</span>
                          {product.is_clearance && product.clearance_price
                            ? <span className="text-orange-500 font-medium">{fmt(product.clearance_price)} sale</span>
                            : <span className="font-medium text-gray-600">{fmt(product.price)}</span>
                          }
                        </p>
                      </div>
                      {alreadyFeatured && (
                        <span className="text-xs text-indigo-500 font-semibold shrink-0">Featured</span>
                      )}
                    </label>
                  )
                })
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4 shrink-0">
              <button
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFeatured}
                disabled={selected.size === 0 || adding}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {adding ? 'Adding…' : selected.size > 0 ? `Add ${selected.size} Product${selected.size > 1 ? 's' : ''}` : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
