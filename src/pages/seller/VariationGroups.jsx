import { useState, useEffect, useRef } from 'react'
import {
  getVariationGroups,
  createVariationGroup,
  updateVariationGroup,
  deleteVariationGroup,
  getProducts,
} from '../../api'
import { PageLayout, PageHeader, Button, SearchBar, DataTable } from '../../components/DesignSystem'

export default function VariationGroups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mainSearch, setMainSearch] = useState('')

  const filteredGroups = groups.filter(g => {
    const query = mainSearch.toLowerCase().trim()
    if (!query) return true
    if (g.group_name.toLowerCase().includes(query)) return true
    const prods = g.products || []
    return prods.some(p => p.name.toLowerCase().includes(query))
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [formName, setFormName] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedProducts, setSelectedProducts] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [takenIds, setTakenIds] = useState(new Set())

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const searchRef = useRef(null)

  const loadGroups = async () => {
    try {
      const res = await getVariationGroups()
      setGroups(res.data.data.groups || [])
    } catch {
      setError('Failed to load variation groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGroups() }, [])

  // Debounced product search inside dialog
  useEffect(() => {
    if (!dialogOpen || !searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await getProducts({ search: searchQuery, limit: 20 })
        setSearchResults(res.data.data.products)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [searchQuery, dialogOpen])

  const openCreate = () => {
    const taken = new Set(groups.flatMap(g => g.product_ids))
    setEditingGroup(null)
    setFormName('')
    setSelectedIds(new Set())
    setSelectedProducts([])
    setTakenIds(taken)
    setSearchQuery('')
    setSearchResults([])
    setSaveError(null)
    setDialogOpen(true)
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  const openEdit = (group) => {
    const taken = new Set(
      groups.filter(g => g.id !== group.id).flatMap(g => g.product_ids)
    )
    setEditingGroup(group)
    setFormName(group.group_name)
    setSelectedIds(new Set(group.product_ids))
    setSelectedProducts(group.products || [])
    setTakenIds(taken)
    setSearchQuery('')
    setSearchResults([])
    setSaveError(null)
    setDialogOpen(true)
  }

  const toggleProduct = (product) => {
    const newIds = new Set(selectedIds)
    const newSelected = [...selectedProducts]
    if (newIds.has(product.id)) {
      newIds.delete(product.id)
      const idx = newSelected.findIndex(p => p.id === product.id)
      if (idx !== -1) newSelected.splice(idx, 1)
    } else {
      newIds.add(product.id)
      if (!newSelected.find(p => p.id === product.id)) newSelected.push(product)
    }
    setSelectedIds(newIds)
    setSelectedProducts(newSelected)
  }

  const handleSave = async () => {
    if (!formName.trim()) return setSaveError('Group name is required')
    if (selectedIds.size < 2) return setSaveError('Select at least 2 products to form a variation group')
    setSaving(true)
    setSaveError(null)
    try {
      const payload = { group_name: formName.trim(), product_ids: [...selectedIds] }
      if (editingGroup) {
        const res = await updateVariationGroup(editingGroup.id, payload)
        const updated = { ...res.data.data.group, products: selectedProducts }
        setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
      } else {
        const res = await createVariationGroup(payload)
        const created = { ...res.data.data.group, products: selectedProducts }
        setGroups((prev) => [...prev, created])
      }
      setDialogOpen(false)
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try {
      await deleteVariationGroup(id)
      setDeleteConfirm(null)
      setGroups((prev) => prev.filter((g) => g.id !== id))
    } catch {
      setDeleting(false)
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Product Variation Groups"
        subtitle="Link related products (Color, Size, Flavor, etc.) so buyers can switch between them."
        action={
          <Button onClick={openCreate}>+ Create Group</Button>
        }
      />

      <div className="flex items-center gap-3 bg-white p-3 border border-gray-200 rounded-xl shadow-2xs">
        <SearchBar
          value={mainSearch}
          onChange={e => setMainSearch(e.target.value)}
          placeholder="Search groups by group name or product name..."
        />
      </div>

      {error && <div className="text-sm text-red-500 mb-4">{error}</div>}

      <DataTable
        headers={[
          'S.No',
          'Group Name',
          'Products',
          { label: 'Count', align: 'center', width: '64px' },
          { label: 'Created', width: '112px' },
          { label: 'Actions', align: 'right', width: '148px' }
        ]}
        empty={!loading && filteredGroups.length === 0}
        loading={loading}
      >
        {filteredGroups.map((g, index) => {
          const prods = g.products || []
          return (
            <tr key={g.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{g.group_name}</td>
              <td className="px-4 py-3 text-gray-600">
                {prods.slice(0, 3).map(p => p.name).join(', ')}
                {prods.length > 3 && (
                  <span className="text-gray-400"> +{prods.length - 3} more</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 text-center">{g.product_ids.length}</td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {new Date(g.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => openEdit(g)}
                    className="py-0.5 px-2 text-xs"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setDeleteConfirm(g.id)}
                    className="py-0.5 px-2 text-xs"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>

      {/* Create / Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Dialog header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-gray-900">
                {editingGroup ? 'Edit Variation Group' : 'Create Variation Group'}
              </h2>
              <button
                onClick={() => setDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Dialog body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Group Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Group Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Coca Cola 500ml Flavors"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Selected chips */}
              {selectedProducts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Selected ({selectedProducts.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProducts.map(p => (
                      <span
                        key={p.id}
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full"
                      >
                        {p.name}
                        <button
                          onClick={() => toggleProduct(p)}
                          className="text-indigo-400 hover:text-indigo-700 leading-none"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Product search */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search Products</label>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type product name to search…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Search results */}
              {searchQuery.trim() && (
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  {searching ? (
                    <div className="text-xs text-gray-400 p-3">Searching…</div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-xs text-gray-400 p-3">No products found</div>
                  ) : (
                    searchResults.map(p => {
                      const inGroup = selectedIds.has(p.id)
                      const takenByOther = takenIds.has(p.id) && !inGroup
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 ${
                            takenByOther
                              ? 'opacity-50 cursor-not-allowed bg-gray-50'
                              : 'cursor-pointer hover:bg-indigo-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={inGroup}
                            disabled={takenByOther}
                            onChange={() => !takenByOther && toggleProduct(p)}
                            className="rounded text-indigo-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                            <div className="text-xs text-gray-400">
                              {p.sku_id ? `SKU: ${p.sku_id} · ` : ''}
                              {p.main_category}
                            </div>
                          </div>
                          {takenByOther && (
                            <span className="text-xs text-amber-600 shrink-0">In another group</span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {saveError && (
              <p className="px-6 pb-2 text-xs text-red-500">{saveError}</p>
            )}

            {/* Dialog footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : editingGroup ? 'Update Group' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Variation Group?</h3>
            <p className="text-sm text-gray-500 mb-5">
              The group will be deleted. All products remain unchanged and independent.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
