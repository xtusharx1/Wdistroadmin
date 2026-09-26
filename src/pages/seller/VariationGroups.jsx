import { useState, useEffect, useRef } from 'react'
import {
  getVariationGroups,
  createVariationGroup,
  updateVariationGroup,
  deleteVariationGroup,
  getProducts,
  getCollections,
  bulkUpdateVariations,
} from '../../api'
import { getUser } from '../../auth'
import { PageLayout, PageHeader, Button, SearchBar, DataTable, Pagination } from '../../components/DesignSystem'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function VariationGroups() {
  const user = getUser()
  const isAdmin = user?.role === 'Admin'

  const [groups, setGroups] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [warningMsg, setWarningMsg] = useState(null)
  const [mainSearch, setMainSearch] = useState('')

  // Expand / collapse state for each group's variations
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  // Bulk update selection state
  const [selectedVariationIds, setSelectedVariationIds] = useState(new Set())
  const [activeGroup, setActiveGroup] = useState(null) // { id, group_name }

  // Bulk update modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    price: '',
    deal_price: '',
    purchase_cost: '',
    stock_quantity: '',
    is_active: '',
    product_collection_id: '',
  })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  // Group Create / Edit dialog state
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

  const notify = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  const showWarning = (text) => {
    setWarningMsg(text)
    setTimeout(() => setWarningMsg(null), 4000)
  }

  const loadGroups = async () => {
    try {
      const res = await getVariationGroups()
      const list = res.data.data.groups || []
      setGroups(list)
      // By default keep variation groups minimized (collapsed)
      setExpandedGroups(new Set())
    } catch {
      setError('Failed to load variation groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
    getCollections({ active_only: true })
      .then(res => setCollections(res.data.data.collections || []))
      .catch(err => console.error('Failed to load collections:', err))
  }, [])

  // Debounced product search inside group create/edit dialog
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

  const toggleExpandGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  // ── Single-Product Bulk Selection Handler ─────────────────────────────────
  const handleToggleVariation = (group, product) => {
    // If another group is currently active, block and warn
    if (activeGroup && activeGroup.id !== group.id) {
      showWarning('Bulk update can only be performed on variations of the same product.')
      return
    }

    const nextIds = new Set(selectedVariationIds)
    if (nextIds.has(product.id)) {
      nextIds.delete(product.id)
      if (nextIds.size === 0) {
        setActiveGroup(null)
      }
    } else {
      nextIds.add(product.id)
      if (!activeGroup) {
        setActiveGroup({ id: group.id, group_name: group.group_name })
      }
    }
    setSelectedVariationIds(nextIds)
  }

  const handleToggleGroupAll = (group) => {
    if (activeGroup && activeGroup.id !== group.id) {
      showWarning('Bulk update can only be performed on variations of the same product.')
      return
    }

    const prods = group.products || []
    const groupProdIds = prods.map(p => p.id)
    const allSelected = groupProdIds.every(id => selectedVariationIds.has(id))

    if (allSelected) {
      // Deselect all
      setSelectedVariationIds(new Set())
      setActiveGroup(null)
    } else {
      // Select all for this group and ensure it is expanded
      setSelectedVariationIds(new Set(groupProdIds))
      setActiveGroup({ id: group.id, group_name: group.group_name })
      setExpandedGroups(prev => new Set([...prev, group.id]))
    }
  }

  const handleClearSelection = () => {
    setSelectedVariationIds(new Set())
    setActiveGroup(null)
    setWarningMsg(null)
  }

  // ── Bulk Update Execution ──────────────────────────────────────────────────
  const openBulkModal = () => {
    if (selectedVariationIds.size === 0) return
    setBulkForm({
      price: '',
      deal_price: '',
      purchase_cost: '',
      stock_quantity: '',
      is_active: '',
      product_collection_id: '',
    })
    setBulkError(null)
    setBulkModalOpen(true)
  }

  const handleApplyBulkUpdate = async (e) => {
    if (e) e.preventDefault()
    if (!activeGroup || selectedVariationIds.size === 0) return

    // Build update object only with entered values
    const updates = {}
    if (bulkForm.price.trim() !== '') {
      const p = parseFloat(bulkForm.price)
      if (isNaN(p) || p < 0) return setBulkError('Price must be a valid positive number.')
      updates.price = p
    }

    if (bulkForm.deal_price.trim() !== '') {
      const dp = parseFloat(bulkForm.deal_price)
      if (isNaN(dp) || dp < 0) return setBulkError('Deal price must be a valid positive number.')
      updates.deal_price = dp
    }

    if (isAdmin && bulkForm.purchase_cost.trim() !== '') {
      const pc = parseFloat(bulkForm.purchase_cost)
      if (isNaN(pc) || pc < 0) return setBulkError('Purchase cost must be a valid positive number.')
      updates.purchase_cost = pc
    }

    if (bulkForm.stock_quantity.trim() !== '') {
      const sq = parseInt(bulkForm.stock_quantity, 10)
      if (isNaN(sq) || sq < 0) return setBulkError('Stock quantity must be a valid non-negative integer.')
      updates.stock_quantity = sq
    }

    if (bulkForm.is_active !== '') {
      updates.is_active = bulkForm.is_active === 'true'
    }

    if (bulkForm.product_collection_id !== '') {
      updates.product_collection_id = bulkForm.product_collection_id === 'none' ? null : parseInt(bulkForm.product_collection_id, 10)
    }

    if (Object.keys(updates).length === 0) {
      return setBulkError('Please enter at least one field to bulk update.')
    }

    setBulkSaving(true)
    setBulkError(null)

    try {
      const payload = {
        product_ids: [...selectedVariationIds],
        updates,
      }
      const res = await bulkUpdateVariations(payload)

      // Update the local groups state with updated variations
      const updatedProducts = res.data.data.products || []
      const updatedMap = new Map(updatedProducts.map(p => [p.id, p]))

      setGroups(prev => prev.map(g => {
        if (g.id !== activeGroup.id) return g
        return {
          ...g,
          products: (g.products || []).map(p => updatedMap.get(p.id) || p),
        }
      }))

      notify(`Successfully updated ${selectedVariationIds.size} variations for "${activeGroup.group_name}".`)
      setBulkModalOpen(false)
      handleClearSelection()
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Failed to bulk update variations.')
    } finally {
      setBulkSaving(false)
    }
  }

  // ── Create / Edit Variation Group Dialog Handlers ──────────────────────────
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
        notify('Variation group updated.')
      } else {
        const res = await createVariationGroup(payload)
        const created = { ...res.data.data.group, products: selectedProducts }
        setGroups((prev) => [...prev, created])
        setExpandedGroups(prev => new Set([...prev, created.id]))
        notify('Variation group created.')
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
      if (activeGroup?.id === id) handleClearSelection()
      notify('Variation group deleted.')
    } catch {
      setDeleting(false)
    }
  }

  const [page, setPage] = useState(1)
  const LIMIT = 10

  useEffect(() => {
    setPage(1)
  }, [mainSearch])

  const filteredGroups = groups.filter(g => {
    const query = mainSearch.toLowerCase().trim()
    if (!query) return true
    if (g.group_name.toLowerCase().includes(query)) return true
    const prods = g.products || []
    return prods.some(p => p.name.toLowerCase().includes(query))
  })

  const totalPages = Math.ceil(filteredGroups.length / LIMIT) || 1
  const paginatedGroups = filteredGroups.slice((page - 1) * LIMIT, page * LIMIT)

  // Selected variation product objects for the modal preview
  const selectedVariationsList = activeGroup
    ? (groups.find(g => g.id === activeGroup.id)?.products || []).filter(p => selectedVariationIds.has(p.id))
    : []

  return (
    <PageLayout>
      <PageHeader
        title="Product Variation Groups"
        subtitle="Manage variation groups and bulk update prices, deals, stock, and status for variations of a single product."
        action={
          <Button onClick={openCreate}>+ Create Group</Button>
        }
      />

      {/* Main Search & Expand/Collapse controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-gray-200 rounded-xl shadow-2xs">
        <SearchBar
          value={mainSearch}
          onChange={e => setMainSearch(e.target.value)}
          placeholder="Search groups by group name or product name..."
        />
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            variant="secondary"
            onClick={() => {
              if (expandedGroups.size === filteredGroups.length) {
                setExpandedGroups(new Set())
              } else {
                setExpandedGroups(new Set(filteredGroups.map(g => g.id)))
              }
            }}
            className="py-1.5 px-3 text-xs"
          >
            {expandedGroups.size === filteredGroups.length && filteredGroups.length > 0
              ? 'Collapse All'
              : 'Expand All'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {msg && (
        <div className={`p-3 rounded-lg text-xs font-medium ${
          msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Warning banner when trying to select multiple products */}
      {warningMsg && (
        <div className="p-3 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{warningMsg}</span>
          </div>
          <button onClick={() => setWarningMsg(null)} className="text-amber-600 hover:text-amber-800 font-bold">&times;</button>
        </div>
      )}

      {error && <div className="text-sm text-red-500 mb-4">{error}</div>}

      {/* ── Active Bulk Update Sticky / Prominent Bar ── */}
      {activeGroup && selectedVariationIds.size > 0 && (
        <div className="sticky top-2 z-20 bg-indigo-900 text-white px-5 py-3.5 rounded-xl shadow-lg border border-indigo-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-700 text-sm">📦</span>
            <div>
              <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Bulk Update Mode Active</div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Product:</span>
                <span className="bg-indigo-800 px-2 py-0.5 rounded text-indigo-100 font-mono text-xs">{activeGroup.group_name}</span>
                <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded-full font-medium">
                  {selectedVariationIds.size} variation{selectedVariationIds.size > 1 ? 's' : ''} selected
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-200 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={openBulkModal}
              className="px-4 py-1.5 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-lg text-xs shadow transition-all flex items-center gap-1.5"
            >
              <span>✏️</span>
              <span>Bulk Update ({selectedVariationIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Groups List with Accordion of Variations */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            Loading variation groups…
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            No variation groups found
          </div>
        ) : (
          paginatedGroups.map((g, index) => {
            const sNo = (page - 1) * LIMIT + index + 1
            const prods = g.products || []
            const isExpanded = expandedGroups.has(g.id)
            const isThisGroupActive = activeGroup?.id === g.id
            const isGroupLocked = activeGroup && activeGroup.id !== g.id
            const groupSelectedCount = prods.filter(p => selectedVariationIds.has(p.id)).length
            const isAllGroupSelected = prods.length > 0 && groupSelectedCount === prods.length

            return (
              <div
                key={g.id}
                className={`bg-white rounded-xl border transition-all shadow-2xs overflow-hidden ${
                  isThisGroupActive
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                    : isGroupLocked
                    ? 'border-gray-200 opacity-80'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Group Header Card */}
                <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                  isThisGroupActive ? 'bg-indigo-50/50 border-indigo-100' : isGroupLocked ? 'bg-gray-50/70 border-gray-100' : 'bg-white border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpandGroup(g.id)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                      title={isExpanded ? 'Collapse variations' : 'Expand variations'}
                    >
                      <svg
                        className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400">#{sNo}</span>
                        <h3 className="font-bold text-gray-900 text-sm hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => toggleExpandGroup(g.id)}>
                          {g.group_name}
                        </h3>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {prods.length} variations
                        </span>
                        {isThisGroupActive && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                            Active for Bulk Update ({groupSelectedCount} selected)
                          </span>
                        )}
                        {isGroupLocked && (
                          <span className="text-2xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1" title={`Bulk update is currently active for "${activeGroup.group_name}". Clear selection to select this product.`}>
                            🔒 Locked (another product selected)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>Created: {new Date(g.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="truncate max-w-md text-gray-600">{prods.map(p => p.name).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Select all button for this group */}
                    <button
                      type="button"
                      disabled={isGroupLocked}
                      onClick={() => handleToggleGroupAll(g)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                        isGroupLocked
                          ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                          : isAllGroupSelected
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-800 hover:bg-indigo-200'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      title={isGroupLocked ? 'Clear active bulk selection first' : isAllGroupSelected ? 'Deselect all variations' : 'Select all variations in this group'}
                    >
                      {isAllGroupSelected ? 'Deselect All' : 'Select All Variations'}
                    </button>

                    <Button
                      variant="secondary"
                      onClick={() => openEdit(g)}
                      className="py-1 px-2.5 text-xs"
                    >
                      Edit Group
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setDeleteConfirm(g.id)}
                      className="py-1 px-2.5 text-xs"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Expanded Variations Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wide text-2xs">
                        <tr>
                          <th className="px-4 py-2 text-left w-10">
                            <input
                              type="checkbox"
                              checked={isAllGroupSelected}
                              disabled={isGroupLocked}
                              onChange={() => handleToggleGroupAll(g)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </th>
                          <th className="px-3 py-2 text-left">Variation Product</th>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Deal Price</th>
                          {isAdmin && <th className="px-3 py-2 text-right">Purchase Cost</th>}
                          <th className="px-3 py-2 text-center">Stock</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {prods.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} className="px-4 py-4 text-center text-gray-400">
                              No variation products linked to this group.
                            </td>
                          </tr>
                        ) : (
                          prods.map((p) => {
                            const isSelected = selectedVariationIds.has(p.id)
                            return (
                              <tr
                                key={p.id}
                                onClick={() => handleToggleVariation(g, p)}
                                className={`transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50/80 font-medium'
                                    : isGroupLocked
                                    ? 'opacity-60 bg-gray-50/50 hover:bg-amber-50/30'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isGroupLocked}
                                    onChange={() => handleToggleVariation(g, p)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-gray-900 flex items-center gap-2">
                                  {p.image_url ? (
                                    <img src={p.image_url} alt={p.name} className="w-6 h-6 object-cover rounded border border-gray-200" />
                                  ) : (
                                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-2xs">N/A</div>
                                  )}
                                  <span className="font-semibold">{p.name}</span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-500 font-mono">{p.sku_id || '—'}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-gray-900">{fmt(p.price)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-orange-600">
                                  {p.deal_price != null ? fmt(p.deal_price) : '—'}
                                </td>
                                {isAdmin && (
                                  <td className="px-3 py-2.5 text-right text-gray-600">
                                    {p.purchase_cost != null ? fmt(p.purchase_cost) : '—'}
                                  </td>
                                )}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${
                                    p.stock_quantity <= 0 ? 'bg-red-100 text-red-700' : p.stock_quantity < 10 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {p.stock_quantity} in stock
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${
                                    p.is_active !== false ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {p.is_active !== false ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      <Pagination
        current={page}
        totalPages={totalPages}
        totalItems={filteredGroups.length}
        onPageChange={(p) => setPage(p)}
      />

      {/* ── Bulk Update Modal ──────────────────────────────────────────────── */}
      {bulkModalOpen && activeGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fadeIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50 rounded-t-2xl">
              <div>
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Single-Product Bulk Update</div>
                <h2 className="font-bold text-gray-900 text-base">
                  {activeGroup.group_name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Updating {selectedVariationIds.size} selected variation{selectedVariationIds.size > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleApplyBulkUpdate} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Selected Variations Summary Chips */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Selected Variations ({selectedVariationsList.length})
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {selectedVariationsList.map(v => (
                    <span
                      key={v.id}
                      className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1"
                    >
                      {v.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-2xs text-gray-500 italic mb-3">
                  Tip: Leave any field blank to keep its current value unchanged across the selected variations.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Price */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">New Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkForm.price}
                      onChange={e => setBulkForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="Keep current"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Deal Price */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">New Deal Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bulkForm.deal_price}
                      onChange={e => setBulkForm(f => ({ ...f, deal_price: e.target.value }))}
                      placeholder="Keep current"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Purchase Cost (Admin only) */}
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bulkForm.purchase_cost}
                        onChange={e => setBulkForm(f => ({ ...f, purchase_cost: e.target.value }))}
                        placeholder="Keep current"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* Stock Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={bulkForm.stock_quantity}
                      onChange={e => setBulkForm(f => ({ ...f, stock_quantity: e.target.value }))}
                      placeholder="Keep current"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Collection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Product Collection</label>
                    <select
                      value={bulkForm.product_collection_id}
                      onChange={e => setBulkForm(f => ({ ...f, product_collection_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Keep current collection</option>
                      <option value="none">No Collection (Remove)</option>
                      {collections.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Active Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Active Status</label>
                    <select
                      value={bulkForm.is_active}
                      onChange={e => setBulkForm(f => ({ ...f, is_active: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Keep current status</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {bulkError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-200">
                  {bulkError}
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {bulkSaving ? 'Updating…' : `Update ${selectedVariationIds.size} Variations`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create / Edit Group Dialog ─────────────────────────────────────── */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
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

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
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

