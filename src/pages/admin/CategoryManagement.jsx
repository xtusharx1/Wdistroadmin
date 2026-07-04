import { useState, useEffect } from 'react'
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../../api'
import { PageLayout, PageHeader, Button, SearchBar, Dialog as Modal, Field } from '../../components/DesignSystem'

export default function CategoryManagement() {
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [notify, setNotify] = useState(null)
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('create') // 'create' or 'edit'
  const [selectedCategory, setSelectedCategory] = useState(null)
  
  // Form states
  const [categoryName, setCategoryName] = useState('')
  const [subCategories, setSubCategories] = useState([])
  const [displayOrder, setDisplayOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [subInput, setSubInput] = useState('')

  // Expand states for cards
  const [expandedCards, setExpandedCards] = useState({})

  const triggerNotification = (message, type = 'success') => {
    setNotify({ message, type })
    setTimeout(() => setNotify(null), 4000)
  }

  const loadCategories = async () => {
    setLoading(true)
    try {
      const res = await getCategories(search ? { search } : undefined)
      setCategories(res.data.data.categories || [])
    } catch (err) {
      console.error('Error loading categories:', err)
      triggerNotification('Failed to load categories.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [search])

  const sortCategories = (list) =>
    [...list].sort((a, b) => (a.display_order - b.display_order) || (a.id - b.id))

  const applyCategoryUpdate = (updated) => {
    setCategories((prev) => sortCategories(prev.map((c) => (c.id === updated.id ? updated : c))))
  }

  const applyCategoryCreate = (created) => {
    if (search && !created.category_name.toLowerCase().includes(search.toLowerCase())) return
    setCategories((prev) => sortCategories([...prev, created]))
  }

  const toggleExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const openCreateModal = () => {
    setModalType('create')
    setCategoryName('')
    setSubCategories([])
    setDisplayOrder(categories.length + 1)
    setIsActive(true)
    setSubInput('')
    setModalOpen(true)
  }

  const openEditModal = (cat) => {
    setSelectedCategory(cat)
    setModalType('edit')
    setCategoryName(cat.category_name)
    setSubCategories([...(cat.sub_categories || [])])
    setDisplayOrder(cat.display_order)
    setIsActive(cat.is_active)
    setSubInput('')
    setModalOpen(true)
  }

  const handleAddSubcategory = () => {
    const val = subInput.trim()
    if (!val) return
    
    // Check duplication
    if (subCategories.some(s => s.toLowerCase() === val.toLowerCase())) {
      triggerNotification(`Subcategory "${val}" already exists in this category.`, 'error')
      return
    }

    setSubCategories(prev => [...prev, val])
    setSubInput('')
  }

  const handleRemoveSubcategory = (index) => {
    setSubCategories(prev => prev.filter((_, i) => i !== index))
  }

  const handleEditSubcategory = (index, value) => {
    const trimmed = value.trim()
    if (!trimmed) return

    // Check duplicate (excluding itself)
    const exists = subCategories.some((s, i) => i !== index && s.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      triggerNotification(`Subcategory "${trimmed}" already exists in this category.`, 'error')
      return
    }

    setSubCategories(prev => prev.map((s, i) => (i === index ? trimmed : s)))
  }

  const handleMoveSubcategory = (index, direction) => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === subCategories.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const copy = [...subCategories]
    const temp = copy[index]
    copy[index] = copy[targetIndex]
    copy[targetIndex] = temp
    setSubCategories(copy)
  }

  const handleSaveCategory = async (e) => {
    e.preventDefault()
    if (!categoryName.trim()) {
      triggerNotification('Category Name is required.', 'error')
      return
    }

    const payload = {
      category_name: categoryName.trim(),
      sub_categories: subCategories,
      display_order: parseInt(displayOrder) || 0,
      is_active: isActive
    }

    try {
      let res
      if (modalType === 'create') {
        res = await createCategory(payload)
      } else {
        res = await updateCategory(selectedCategory.id, payload)
      }

      if (res.data.success) {
        triggerNotification(res.data.message || 'Category saved successfully.')
        setModalOpen(false)
        if (modalType === 'create') {
          applyCategoryCreate(res.data.data.category)
        } else {
          applyCategoryUpdate(res.data.data.category)
        }
      } else {
        triggerNotification(res.data.message || 'Failed to save category.', 'error')
      }
    } catch (err) {
      console.error('Error saving category:', err)
      triggerNotification(err.response?.data?.message || 'Failed to save category.', 'error')
    }
  }

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete "${cat.category_name}"?`)) return

    try {
      const res = await deleteCategory(cat.id)
      if (res.data.success) {
        triggerNotification('Category deleted successfully.')
        setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      } else {
        triggerNotification(res.data.message || 'Failed to delete category.', 'error')
      }
    } catch (err) {
      console.error('Error deleting category:', err)
      triggerNotification(err.response?.data?.message || 'Failed to delete category.', 'error')
    }
  }

  const handleToggleActive = async (cat) => {
    const payload = {
      category_name: cat.category_name,
      sub_categories: cat.sub_categories,
      display_order: cat.display_order,
      is_active: !cat.is_active
    }

    try {
      const res = await updateCategory(cat.id, payload)
      if (res.data.success) {
        triggerNotification(`Category "${cat.category_name}" ${!cat.is_active ? 'enabled' : 'disabled'}.`)
        applyCategoryUpdate(res.data.data.category)
      }
    } catch (err) {
      console.error('Error toggling category status:', err)
      triggerNotification('Failed to toggle category status.', 'error')
    }
  }

  const handleAdjustOrder = async (cat, direction) => {
    const targetOrder = direction === 'up' ? cat.display_order - 1 : cat.display_order + 1
    const payload = {
      category_name: cat.category_name,
      sub_categories: cat.sub_categories,
      display_order: Math.max(0, targetOrder),
      is_active: cat.is_active
    }

    try {
      const res = await updateCategory(cat.id, payload)
      if (res.data.success) {
        applyCategoryUpdate(res.data.data.category)
      }
    } catch (err) {
      console.error('Error moving category order:', err)
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Category Management"
        subtitle="Manage database-driven categories and their subcategories for the store and mobile clients."
        action={
          <Button onClick={openCreateModal}>
            Add Category
          </Button>
        }
      />

      {/* Notifications */}
      {notify && (
        <div
          className={`rounded-md px-4 py-3 text-sm flex items-center justify-between shadow-sm border ${
            notify.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}
        >
          <span>{notify.message}</span>
          <button onClick={() => setNotify(null)} className="text-xs font-semibold underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* Search Filter */}
      <div className="flex items-center gap-3 bg-white p-3 border border-gray-200 rounded-xl shadow-2xs">
        <SearchBar
          placeholder="Search categories by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={loadCategories}
        >
          Refresh
        </Button>
      </div>

      {/* Categories Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-gray-200 rounded-lg text-sm text-gray-400">
            No categories found.
          </div>
        ) : (
          categories.map((cat) => {
            const isExpanded = !!expandedCards[cat.id]
            return (
              <div
                key={cat.id}
                className={`bg-white border rounded-xl shadow-2xs transition-all overflow-hidden ${
                  cat.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50/50 opacity-80'
                }`}
              >
                {/* Card Header Section */}
                <div className="flex items-center justify-between p-4 sm:p-5 flex-wrap sm:flex-nowrap gap-4">
                  <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleExpand(cat.id)}>
                    <span className="text-gray-400 hover:text-gray-600 transition-colors text-lg font-bold">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{cat.category_name}</h3>
                        {!cat.is_active && (
                          <span className="bg-red-50 text-red-700 text-3xs font-semibold px-2 py-0.5 rounded border border-red-100 uppercase">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-3xs text-gray-400 mt-1">
                        Order: {cat.display_order} | {cat.sub_categories?.length || 0} Subcategories
                      </p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 sm:ml-auto">
                    {/* Move display order */}
                    <button
                      onClick={() => handleAdjustOrder(cat, 'up')}
                      title="Move Up"
                      className="border border-gray-200 hover:bg-gray-50 text-gray-600 p-1.5 rounded transition-colors text-xs"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleAdjustOrder(cat, 'down')}
                      title="Move Down"
                      className="border border-gray-200 hover:bg-gray-50 text-gray-600 p-1.5 rounded transition-colors text-xs"
                    >
                      ▼
                    </button>
                    
                    {/* Active toggle */}
                    <button
                      onClick={() => handleToggleActive(cat)}
                      className={`font-semibold text-xs px-2.5 py-1.5 rounded transition-colors ${
                        cat.is_active
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                      }`}
                    >
                      {cat.is_active ? 'Disable' : 'Enable'}
                    </button>

                    {/* Edit Name */}
                    <button
                      onClick={() => openEditModal(cat)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs px-2.5 py-1.5 rounded transition-colors"
                    >
                      Edit
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs px-2.5 py-1.5 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Subcategories Expandable Section */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-gray-50/30">
                    <div className="max-w-xl space-y-3">
                      <h4 className="text-3xs uppercase tracking-wider text-gray-400 font-bold">Subcategories</h4>
                      
                      {(!cat.sub_categories || cat.sub_categories.length === 0) ? (
                        <p className="text-xs text-gray-400 italic">No subcategories defined.</p>
                      ) : (
                        <div className="divide-y divide-gray-150 border border-gray-200 rounded-lg bg-white overflow-hidden">
                          {cat.sub_categories.map((sub, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50/50">
                              <span className="text-gray-900 font-medium">{sub}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    const value = prompt('Edit subcategory name:', sub)
                                    if (value && value.trim()) {
                                      const copy = [...cat.sub_categories]
                                      const trimmed = value.trim()
                                      if (copy.some((s, i) => i !== idx && s.toLowerCase() === trimmed.toLowerCase())) {
                                        triggerNotification('Subcategory already exists.', 'error')
                                        return
                                      }
                                      copy[idx] = trimmed
                                      updateCategory(cat.id, {
                                        category_name: cat.category_name,
                                        sub_categories: copy,
                                        display_order: cat.display_order,
                                        is_active: cat.is_active
                                      }).then((res) => applyCategoryUpdate(res.data.data.category))
                                    }
                                  }}
                                  className="text-indigo-600 hover:text-indigo-900 text-2xs font-semibold underline"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Remove subcategory "${sub}"?`)) {
                                      const copy = cat.sub_categories.filter((_, i) => i !== idx)
                                      updateCategory(cat.id, {
                                        category_name: cat.category_name,
                                        sub_categories: copy,
                                        display_order: cat.display_order,
                                        is_active: cat.is_active
                                      }).then((res) => applyCategoryUpdate(res.data.data.category))
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 text-2xs font-semibold underline"
                                >
                                  Remove
                                </button>
                                <button
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const copy = [...cat.sub_categories]
                                    const t = copy[idx]
                                    copy[idx] = copy[idx - 1]
                                    copy[idx - 1] = t
                                    updateCategory(cat.id, {
                                      category_name: cat.category_name,
                                      sub_categories: copy,
                                      display_order: cat.display_order,
                                      is_active: cat.is_active
                                    }).then((res) => applyCategoryUpdate(res.data.data.category))
                                  }}
                                  className="text-gray-400 hover:text-gray-700 text-xs px-1"
                                >
                                  ▲
                                </button>
                                <button
                                  disabled={idx === cat.sub_categories.length - 1}
                                  onClick={() => {
                                    const copy = [...cat.sub_categories]
                                    const t = copy[idx]
                                    copy[idx] = copy[idx + 1]
                                    copy[idx + 1] = t
                                    updateCategory(cat.id, {
                                      category_name: cat.category_name,
                                      sub_categories: copy,
                                      display_order: cat.display_order,
                                      is_active: cat.is_active
                                    }).then((res) => applyCategoryUpdate(res.data.data.category))
                                  }}
                                  className="text-gray-400 hover:text-gray-700 text-xs px-1"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick Add Subcategory form */}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-150">
                        <input
                          type="text"
                          placeholder="Add new subcategory..."
                          id={`new-sub-${cat.id}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = e.target.value.trim()
                              if (val) {
                                if (cat.sub_categories.some(s => s.toLowerCase() === val.toLowerCase())) {
                                  triggerNotification('Subcategory already exists.', 'error')
                                  return
                                }
                                const copy = [...(cat.sub_categories || []), val]
                                updateCategory(cat.id, {
                                  category_name: cat.category_name,
                                  sub_categories: copy,
                                  display_order: cat.display_order,
                                  is_active: cat.is_active
                                }).then((res) => {
                                  e.target.value = ''
                                  applyCategoryUpdate(res.data.data.category)
                                })
                              }
                            }
                          }}
                          className="flex-1 max-w-xs border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => {
                            const inputEl = document.getElementById(`new-sub-${cat.id}`)
                            const val = inputEl.value.trim()
                            if (val) {
                              if (cat.sub_categories.some(s => s.toLowerCase() === val.toLowerCase())) {
                                triggerNotification('Subcategory already exists.', 'error')
                                return
                              }
                              const copy = [...(cat.sub_categories || []), val]
                              updateCategory(cat.id, {
                                category_name: cat.category_name,
                                sub_categories: copy,
                                display_order: cat.display_order,
                                is_active: cat.is_active
                              }).then((res) => {
                                inputEl.value = ''
                                applyCategoryUpdate(res.data.data.category)
                              })
                            }
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded transition-all"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Create / Edit Category Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalType === 'create' ? 'Create Category' : 'Edit Category'}
        size="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-sm">
          <Field label="Category Name" required>
            <input
              type="text"
              required
              placeholder="e.g. Tobacco Accessories"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Display Order" required>
              <input
                type="number"
                required
                min="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>

            <Field label="Status">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span className="text-gray-700 text-xs font-semibold">Active / Enabled</span>
              </label>
            </Field>
          </div>

          {/* Subcategories Editor block inside modal */}
          <div className="space-y-2 border-t border-gray-150 pt-3">
            <label className="text-xs font-semibold text-gray-500">Subcategories Editor</label>
            
            {/* List */}
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-gray-55/30 p-2 divide-y divide-gray-100">
              {subCategories.length === 0 ? (
                <p className="text-xs text-gray-400 italic p-1">No subcategories added yet.</p>
              ) : (
                subCategories.map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5">
                    <span className="text-gray-700 truncate pr-2 font-medium">{sub}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveSubcategory(idx, 'up')}
                        disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-600 text-3xs disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSubcategory(idx, 'down')}
                        disabled={idx === subCategories.length - 1}
                        className="text-gray-400 hover:text-gray-600 text-3xs disabled:opacity-30"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubcategory(idx)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input field to add */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="Enter subcategory name..."
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSubcategory()
                  }
                }}
                className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddSubcategory}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs px-3 py-2 rounded transition-colors"
              >
                Add Subcategory
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-150">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs px-4 py-2 rounded-md shadow-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-md shadow-sm transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
