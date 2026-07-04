import { useState, useEffect, useRef } from 'react'
import {
  getInventoryReceipts,
  getInventoryReceiptDetails,
  createInventoryReceipt,
  uploadInvoiceFile,
  getProducts
} from '../../api'
import Modal from '../../components/Modal'
import { PageLayout, PageHeader, Button, SearchBar, DataTable, Dialog } from '../../components/DesignSystem'

export default function InventoryReceiving() {
  const [activeTab, setActiveTab] = useState('history')
  const [receipts, setReceipts] = useState([])
  const [search, setSearch] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [detailReceipt, setDetailReceipt] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [notify, setNotify] = useState(null)

  // Form states for New Stock Receipt
  const [remarks, setRemarks] = useState('')
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  // Product Search / Added items states
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [addedItems, setAddedItems] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const productSearchDebounce = useRef(null)

  const triggerNotification = (message, type = 'success') => {
    setNotify({ message, type })
    setTimeout(() => setNotify(null), 4000)
  }

  // Fetch receiving history
  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await getInventoryReceipts(search ? { search } : undefined)
      setReceipts(res.data.data.receipts || [])
    } catch (err) {
      console.error('Error loading receiving history:', err)
      triggerNotification('Failed to load receiving history.', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, search])

  // Search products handler
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([])
      return
    }

    if (productSearchDebounce.current) clearTimeout(productSearchDebounce.current)

    productSearchDebounce.current = setTimeout(async () => {
      setSearchingProducts(true)
      try {
        const res = await getProducts({ search: productSearch, limit: 10 })
        setSearchResults(res.data.data.products || [])
      } catch (err) {
        console.error('Error searching products:', err)
      } finally {
        setSearchingProducts(false)
      }
    }, 350)

    return () => clearTimeout(productSearchDebounce.current)
  }, [productSearch])

  // File Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setInvoiceFile(file)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('invoice', file)

      const res = await uploadInvoiceFile(formData)
      if (res.data.success) {
        setInvoiceUrl(res.data.data.url)
        triggerNotification('Supplier invoice uploaded successfully.')
      } else {
        triggerNotification(res.data.message || 'Upload failed.', 'error')
      }
    } catch (err) {
      console.error('Error uploading invoice:', err)
      triggerNotification(err.response?.data?.message || 'Invoice upload failed.', 'error')
      setInvoiceFile(null)
    } finally {
      setUploading(false)
    }
  }

  // Add product to receipt list
  const handleAddProduct = (product) => {
    if (addedItems.find(i => i.product_id === product.id)) {
      triggerNotification('Product is already added. Adjust quantity below.', 'error')
      setProductSearch('')
      setSearchResults([])
      return
    }

    setAddedItems(prev => [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        sku_id: product.sku_id || 'N/A',
        current_stock: product.stock_quantity ?? 0,
        quantity_received: 1
      }
    ])
    setProductSearch('')
    setSearchResults([])
  }

  // Remove product from receipt list
  const handleRemoveItem = (productId) => {
    setAddedItems(prev => prev.filter(item => item.product_id !== productId))
  }

  // Update quantity received
  const handleQtyChange = (productId, qty) => {
    const parsed = Math.max(1, parseInt(qty) || 1)
    setAddedItems(prev =>
      prev.map(item => (item.product_id === productId ? { ...item, quantity_received: parsed } : item))
    )
  }

  // Reset receiving form
  const handleResetForm = () => {
    setRemarks('')
    setInvoiceFile(null)
    setInvoiceUrl('')
    setAddedItems([])
  }

  // Submit Receipt
  const handleSaveReceipt = async (e) => {
    e.preventDefault()

    if (addedItems.length === 0) {
      triggerNotification('Please add at least one product to receive.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        invoice_url: invoiceUrl || null,
        remarks: remarks || null,
        products: addedItems.map(item => ({
          product_id: item.product_id,
          quantity_received: item.quantity_received
        }))
      }

      const res = await createInventoryReceipt(payload)
      if (res.data.success) {
        triggerNotification('Inventory receipt saved and stock updated.')
        handleResetForm()
        setActiveTab('history')
      } else {
        triggerNotification(res.data.message || 'Failed to save receipt.', 'error')
      }
    } catch (err) {
      console.error('Error saving receipt:', err)
      triggerNotification(err.response?.data?.message || 'Failed to save inventory receipt.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // View Details Handler
  const handleViewDetails = async (id) => {
    setDetailLoading(true)
    try {
      const res = await getInventoryReceiptDetails(id)
      setDetailReceipt(res.data.data.receipt)
    } catch (err) {
      console.error('Error fetching receipt details:', err)
      triggerNotification('Failed to fetch receipt details.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  // Helper formats
  const fmtDate = (dStr) => {
    if (!dStr) return '—'
    return new Date(dStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <PageLayout>
      <PageHeader
        title="Inventory Receiving"
        subtitle="Record supplier shipments, upload invoices, and log stock receipts."
      />

      {/* Notifications */}
      {notify && (
        <div
          className={`mb-5 rounded-md px-4 py-3 text-sm flex items-center justify-between shadow-sm border ${
            notify.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}
        >
          <span>{notify.message}</span>
          <button onClick={() => setNotify(null)} className="text-xs font-semibold underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Receiving History
          </button>
          <button
            onClick={() => setActiveTab('new_receipt')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'new_receipt'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            New Stock Receipt
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      {activeTab === 'history' ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by receipt number (e.g. GRN-000001)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={loadHistory}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2 rounded-md shadow-sm transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* History List Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            {loadingHistory ? (
              <div className="p-6 text-sm text-gray-500 text-center">Loading receiving history…</div>
            ) : receipts.length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">No inventory receipts found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['S.No', 'Receipt Number', 'Total Products', 'Total Qty Received', 'Created By', 'Created At', 'View Invoice', 'View Details'].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h.includes('Qty') || h.includes('Products') ? 'text-center' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {receipts.map((r, index) => {
                      const totalQty = (r.items || []).reduce((sum, item) => sum + item.quantity_received, 0)
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{r.receipt_number}</td>
                          <td className="px-4 py-3 text-center">{r.items?.length || 0}</td>
                          <td className="px-4 py-3 text-center font-medium">{totalQty}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-gray-800">{r.ReceivedBy?.name || 'Unknown'}</p>
                              <p className="text-3xs text-gray-400">{r.ReceivedBy?.role || ''}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                          <td className="px-4 py-3">
                            {r.invoice_url ? (
                              <a
                                href={r.invoice_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:text-indigo-900 font-semibold underline text-xs"
                              >
                                View File
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleViewDetails(r.id)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs px-2.5 py-1.5 rounded transition-all"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* New Stock Receipt Form */
        <form onSubmit={handleSaveReceipt} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left side remarks/details */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-2">Receipt Details</h3>
              <Field label="Remarks (Optional)">
                <textarea
                  rows={4}
                  placeholder="Any additional notes or receiving comments..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                />
              </Field>
            </div>

            {/* Right side file upload */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-2">Supplier Invoice</h3>
              
              <Field label="Upload Supplier Invoice (PDF/Image)">
                <div className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <div className="space-y-2">
                    <span className="text-2xl">📄</span>
                    <p className="text-xs text-gray-500 font-medium">Click or Drag invoice to upload</p>
                    <p className="text-3xs text-gray-400">PDF, JPG, PNG, or WEBP up to 10MB</p>
                  </div>
                </div>
              </Field>

              {uploading && (
                <div className="text-xs text-indigo-600 font-semibold animate-pulse flex items-center gap-1.5">
                  <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading to S3...
                </div>
              )}

              {invoiceFile && !uploading && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-md p-3">
                  <p className="text-xs font-semibold text-indigo-800 truncate">Selected File: {invoiceFile.name}</p>
                  {invoiceUrl && (
                    <a
                      href={invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-semibold underline text-2xs block mt-1.5"
                    >
                      View uploaded document
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Product Search & Products Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-2">Products Received</h3>

            {/* Product search input */}
            <div className="relative max-w-md">
              <Field label="Search & Add Product">
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                />
              </Field>

              {searchingProducts && (
                <div className="absolute right-3 bottom-3 text-xs text-gray-400">Searching…</div>
              )}

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-10 divide-y divide-gray-100">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-400">SKU: {product.sku_id || 'N/A'}</p>
                      </div>
                      <span className="text-2xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                        Stock: {product.stock_quantity ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Added products table */}
            {addedItems.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
                No products added yet. Use the search bar above to add products to the receipt.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Product Name', 'SKU', 'Current Stock', 'Quantity Received', 'Remove'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {addedItems.map((item) => (
                      <tr key={item.product_id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600">{item.sku_id}</td>
                        <td className="px-4 py-3 text-gray-500 font-semibold">{item.current_stock}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity_received}
                            onChange={(e) => handleQtyChange(item.product_id, e.target.value)}
                            className="w-32 border border-gray-300 rounded px-2.5 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product_id)}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold underline hover:no-underline"
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
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleResetForm}
              className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm px-5 py-2 rounded-md shadow-sm transition-colors"
              disabled={submitting}
            >
              Reset
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2 rounded-md shadow-sm transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
              disabled={submitting || uploading}
            >
              {submitting ? 'Saving Receipt…' : 'Save Receipt'}
            </button>
          </div>
        </form>
      )}

      {/* Details View Modal */}
      <Modal
        open={!!detailReceipt}
        onClose={() => setDetailReceipt(null)}
        title={`Receipt Details`}
        size="lg"
      >
        {detailReceipt && (
          <div className="space-y-5">
            {/* Meta info card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-3xs uppercase tracking-wider text-gray-400 font-bold">Receipt Number</p>
                <p className="font-semibold text-gray-900 mt-0.5">{detailReceipt.receipt_number}</p>
              </div>
              <div>
                <p className="text-3xs uppercase tracking-wider text-gray-400 font-bold">Created By</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {detailReceipt.ReceivedBy?.name || 'Unknown'} ({detailReceipt.ReceivedBy?.role || ''})
                </p>
              </div>
              <div>
                <p className="text-3xs uppercase tracking-wider text-gray-400 font-bold">Created At</p>
                <p className="font-semibold text-gray-900 mt-0.5">{fmtDate(detailReceipt.created_at)}</p>
              </div>
            </div>

            {/* Remarks */}
            {detailReceipt.remarks && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3.5 text-sm">
                <p className="text-3xs uppercase tracking-wider text-amber-500 font-bold">Remarks</p>
                <p className="text-amber-900 mt-0.5 leading-relaxed">{detailReceipt.remarks}</p>
              </div>
            )}

            {/* Document Link */}
            {detailReceipt.invoice_url && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <span className="text-xs font-semibold text-indigo-900">Uploaded Supplier Invoice (PDF/Image)</span>
                </div>
                <a
                  href={detailReceipt.invoice_url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded transition-all shadow-sm"
                >
                  View Invoice
                </a>
              </div>
            )}

            {/* Products Table */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-2">Products Received</h4>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Product Name', 'SKU ID', 'Qty Received'].map((h) => (
                        <th key={h} className="px-4 py-2 text-xs font-semibold text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(detailReceipt.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{item.Product?.name || `Product #${item.product_id}`}</td>
                        <td className="px-4 py-2.5 text-gray-600">{item.Product?.sku_id || 'N/A'}</td>
                        <td className="px-4 py-2.5 text-gray-800 font-semibold">{item.quantity_received}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex justify-end pt-3">
              <button
                onClick={() => setDetailReceipt(null)}
                className="bg-gray-800 hover:bg-gray-900 text-white font-semibold text-sm px-4 py-2 rounded-md shadow-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
