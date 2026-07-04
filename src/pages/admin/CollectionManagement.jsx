import { useState, useEffect } from 'react'
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection
} from '../../api'
import { PageLayout, PageHeader, Button, SearchBar, Dialog as Modal, Field } from '../../components/DesignSystem'

export default function CollectionManagement() {
  const [collections, setCollections] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [notify, setNotify] = useState(null)
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('create') // 'create' or 'edit'
  const [selectedCollection, setSelectedCollection] = useState(null)
  
  // Form states
  const [collectionName, setCollectionName] = useState('')
  const [isActive, setIsActive] = useState(true)

  const triggerNotification = (message, type = 'success') => {
    setNotify({ message, type })
    setTimeout(() => setNotify(null), 4000)
  }

  const loadCollections = async () => {
    setLoading(true)
    try {
      const res = await getCollections(search ? { search } : undefined)
      setCollections(res.data.data.collections || [])
    } catch (err) {
      console.error('Error loading collections:', err)
      triggerNotification('Failed to load product collections.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCollections()
  }, [search])

  const applyCollectionUpdate = (updated) => {
    setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  const applyCollectionCreate = (created) => {
    if (search && !created.name.toLowerCase().includes(search.toLowerCase())) return
    setCollections((prev) => [...prev, created])
  }

  const openCreateModal = () => {
    setModalType('create')
    setCollectionName('')
    setIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (coll) => {
    setSelectedCollection(coll)
    setModalType('edit')
    setCollectionName(coll.name)
    setIsActive(coll.is_active)
    setModalOpen(true)
  }

  const handleSaveCollection = async (e) => {
    e.preventDefault()
    if (!collectionName.trim()) {
      triggerNotification('Collection Name is required.', 'error')
      return
    }

    const payload = {
      name: collectionName.trim(),
      is_active: isActive
    }

    try {
      let res
      if (modalType === 'create') {
        res = await createCollection(payload)
      } else {
        res = await updateCollection(selectedCollection.id, payload)
      }

      if (res.data.success) {
        triggerNotification(res.data.message || 'Collection saved successfully.')
        setModalOpen(false)
        if (modalType === 'create') {
          applyCollectionCreate(res.data.data.collection)
        } else {
          applyCollectionUpdate(res.data.data.collection)
        }
      } else {
        triggerNotification(res.data.message || 'Failed to save collection.', 'error')
      }
    } catch (err) {
      console.error('Error saving collection:', err)
      triggerNotification(err.response?.data?.message || 'Failed to save collection.', 'error')
    }
  }

  const handleDeleteCollection = async (coll) => {
    if (!window.confirm(`Are you sure you want to delete "${coll.name}"?`)) return

    try {
      const res = await deleteCollection(coll.id)
      if (res.data.success) {
        triggerNotification('Product Collection deleted successfully.')
        setCollections((prev) => prev.filter((c) => c.id !== coll.id))
      } else {
        triggerNotification(res.data.message || 'Failed to delete collection.', 'error')
      }
    } catch (err) {
      console.error('Error deleting collection:', err)
      triggerNotification(err.response?.data?.message || 'Failed to delete collection.', 'error')
    }
  }

  const handleToggleActive = async (coll) => {
    const payload = {
      name: coll.name,
      is_active: !coll.is_active
    }

    try {
      const res = await updateCollection(coll.id, payload)
      if (res.data.success) {
        triggerNotification(`Collection "${coll.name}" ${!coll.is_active ? 'enabled' : 'disabled'}.`)
        applyCollectionUpdate(res.data.data.collection)
      }
    } catch (err) {
      console.error('Error toggling collection status:', err)
      triggerNotification('Failed to toggle collection status.', 'error')
    }
  }

  return (
    <PageLayout>
      <PageHeader
        title="Product Collections"
        subtitle="Manage dynamic promotional categories like Deals, Clearance, and Weekly Specials."
        action={
          <Button onClick={openCreateModal}>
            Add Collection
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
          placeholder="Search collections by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={loadCollections}
        >
          Refresh
        </Button>
      </div>

      {/* Collections list (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500 md:col-span-2">Loading collections...</div>
        ) : collections.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-gray-200 rounded-lg text-sm text-gray-400 md:col-span-2">
            No collections found.
          </div>
        ) : (
          collections.map((coll) => (
            <div
              key={coll.id}
              className={`bg-white border rounded-xl p-4 shadow-2xs flex items-center justify-between gap-4 transition-all ${
                coll.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50/50 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{coll.name}</h3>
                  {!coll.is_active && (
                    <span className="bg-red-50 text-red-700 text-4xs font-semibold px-1.5 py-0.5 rounded border border-red-100 uppercase">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-3xs text-gray-400 mt-1">ID: {coll.id}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggleActive(coll)}
                  className={`font-semibold text-2xs px-2 py-1 rounded transition-colors ${
                    coll.is_active
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                  }`}
                >
                  {coll.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => openEditModal(coll)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-2xs px-2 py-1 rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCollection(coll)}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-2xs px-2 py-1 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Collection Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalType === 'create' ? 'Create Collection' : 'Edit Collection'}
        size="sm"
      >
        <form onSubmit={handleSaveCollection} className="space-y-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">
              Collection Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deals, Clearance"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="isActiveCheck" className="text-gray-700 text-xs font-semibold select-none cursor-pointer">
              Active / Enabled
            </label>
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
