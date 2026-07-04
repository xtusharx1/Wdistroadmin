import { useState, useEffect, useCallback } from 'react'
import { getProducts, createProduct, bulkCreateProducts, updateProduct, deleteProduct, uploadImage, getCategories, getCollections, importProducts, downloadImportTemplate } from '../../api'
import { getUser } from '../../auth'
import { PageLayout, PageHeader, Button, SearchBar, TableToolbar, FilterBar, DataTable, Dialog as Modal } from '../../components/DesignSystem'
import * as XLSX from 'xlsx'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

const FALLBACK_CATEGORY_MAP = {
  'General Merchandise': ['Cables', 'Toys', 'Misc', 'Clothing', 'Supplements', 'Medicine (OTC)'],
  'Glass': ['Glass Rigs', 'Glass Accessories', 'Grinders'],
  'Tobacco': ['Wraps', 'Cigars', 'Cigarillos', 'Rolling Tobacco', 'Chew/Pouches'],
  'Lighters': ['Pocket Torches', 'High Flame', 'Butane', 'Torch Lighters'],
  'Vape': ['Disposable', 'Hardware', 'Vape Accessories', 'Juices'],
  'Rolling Papers': ['Papers', 'Rolling Machine', 'Tips', 'Cones']
}

const getRequiredLicense = (mainCat) => {
  return (mainCat === 'Tobacco' || mainCat === 'Vape') ? 'Tobacco License' : 'Seller Permit'
}

const mapCategoryFromText = (name, desc, mainCatInput, subCatInput) => {
  const text = `${name || ''} ${desc || ''} ${mainCatInput || ''} ${subCatInput || ''}`.toLowerCase();
  
  // Vape matching
  if (/\b(disposable|disposables|geek\s*bar|lost\s*mary|elf\s*bar|vuse|flum|fume|hqd|breeze|mr\s*fog|puff\s*bar|packspod|ebdesign|raz|viho|kadobar|oxbar|vaping)\b/.test(text)) {
    return { mainCat: 'Vape', subCat: 'Disposable' };
  }
  if (/\b(juice|juices|liquid|e-liquid|eliquid|e-juice|ejuice|salt\s*nic|nic\s*salt|pod\s*juice)\b/.test(text)) {
    return { mainCat: 'Vape', subCat: 'Juices' };
  }
  if (/\b(coil|coils|empty\s*pod|empty\s*pods|cartridge|cartridges)\b/.test(text)) {
    return { mainCat: 'Vape', subCat: 'Vape Accessories' };
  }
  if (/\b(mod|vape\s*kit|starter\s*kit|vape\s*device|battery|vaporizer|tanks)\b/.test(text) || /\bvape\b/.test(text)) {
    return { mainCat: 'Vape', subCat: 'Hardware' };
  }

  // Tobacco matching
  if (/\b(wrap|wraps|hemp\s*wrap|hemp\s*wraps|fronto|grabba|loose\s*leaf|king\s*palm|zig\s*zag\s*wrap)\b/.test(text)) {
    return { mainCat: 'Tobacco', subCat: 'Wraps' };
  }
  if (/\b(cigarillo|cigarillos|swisher|white\s*owl|dutch\s*masters|game\s*cigar)\b/.test(text)) {
    return { mainCat: 'Tobacco', subCat: 'Cigarillos' };
  }
  if (/\b(cigar|cigars)\b/.test(text)) {
    return { mainCat: 'Tobacco', subCat: 'Cigars' };
  }
  if (/\b(rolling\s*tobacco|pipe\s*tobacco|loose\s*tobacco)\b/.test(text)) {
    return { mainCat: 'Tobacco', subCat: 'Rolling Tobacco' };
  }
  if (/\b(chew|chews|pouch|pouches|snus|dip|snuff|zyn|velo|rogue)\b/.test(text) || /\btobacco\b/.test(text)) {
    return { mainCat: 'Tobacco', subCat: 'Chew/Pouches' };
  }

  // Rolling Papers matching
  if (/\b(cone|cones|raw\s*cone|raw\s*cones|pre-rolled\s*cone)\b/.test(text)) {
    return { mainCat: 'Rolling Papers', subCat: 'Cones' };
  }
  if (/\b(tip|tips|filter\s*tip|filter\s*tips|crutch|crutches)\b/.test(text)) {
    return { mainCat: 'Rolling Papers', subCat: 'Tips' };
  }
  if (/\b(roller|rolling\s*machine|rolling\s*machines|joint\s*roller)\b/.test(text)) {
    return { mainCat: 'Rolling Papers', subCat: 'Rolling Machine' };
  }
  if (/\b(paper|papers|rolling\s*paper|rolling\s*papers|raw|elements|ocb|zig\s*zag)\b/.test(text)) {
    return { mainCat: 'Rolling Papers', subCat: 'Papers' };
  }

  // Glass matching
  if (/\b(rig|rigs|dab\s*rig|bong|bongs|waterpipe|waterpipes|water\s*pipe|bubbler|recycler)\b/.test(text)) {
    return { mainCat: 'Glass', subCat: 'Glass Rigs' };
  }
  if (/\b(bowl|bowls|slide|banger|bangers|downstem|downstems|ash\s*catcher|carb\s*cap|glass\s*screen|glass\s*pipe|glass\s*pipes|spoon\s*pipe|hand\s*pipe)\b/.test(text)) {
    return { mainCat: 'Glass', subCat: 'Glass Accessories' };
  }
  if (/\b(grinder|grinders)\b/.test(text) || /\bglass\b/.test(text)) {
    return { mainCat: 'Glass', subCat: 'Grinders' };
  }

  // Lighters matching
  if (/\b(butane|butane\s*gas|refill)\b/.test(text)) {
    return { mainCat: 'Lighters', subCat: 'Butane' };
  }
  if (/\b(pocket\s*torch|mini\s*torch)\b/.test(text)) {
    return { mainCat: 'Lighters', subCat: 'Pocket Torches' };
  }
  if (/\b(high\s*flame|blowtorch)\b/.test(text)) {
    return { mainCat: 'Lighters', subCat: 'High Flame' };
  }
  if (/\b(torch\s*lighter|torch\s*lighters)\b/.test(text)) {
    return { mainCat: 'Lighters', subCat: 'Torch Lighters' };
  }
  if (/\b(lighter|lighters|clipper|bic|zippo)\b/.test(text)) {
    return { mainCat: 'Lighters', subCat: 'Pocket Torches' };
  }

  // General Merchandise matching
  if (/\b(cable|cables|charger|chargers|usb|type-c|lightning\s*cable|charging\s*cord)\b/.test(text)) {
    return { mainCat: 'General Merchandise', subCat: 'Cables' };
  }
  if (/\b(toy|toys|plush|novelty)\b/.test(text)) {
    return { mainCat: 'General Merchandise', subCat: 'Toys' };
  }
  if (/\b(clothing|t-shirt|tshirt|hoodie|cap|hat|socks|apparel)\b/.test(text)) {
    return { mainCat: 'General Merchandise', subCat: 'Clothing' };
  }
  if (/\b(supplement|supplements|cbd|gummy|gummi|kratom|kava|nootropic|vitamins)\b/.test(text)) {
    return { mainCat: 'General Merchandise', subCat: 'Supplements' };
  }
  if (/\b(medicine|otc|advil|tylenol|aspirin|ibuprofen|pain\s*relief|allergy)\b/.test(text)) {
    return { mainCat: 'General Merchandise', subCat: 'Medicine (OTC)' };
  }

  return { mainCat: 'General Merchandise', subCat: 'Misc' };
}

const blankForm = { name: '', sku_id: '', mainCategory: '', subCategory: '', price: '', purchaseCost: '', stock_quantity: '', image_url: '', description: '', is_active: true, product_collection_id: '', deal_price: '', billing_name: '', is_explicit_product: false }

export default function Products() {
  const user = getUser()
  const isAdmin = user?.role === 'Admin'
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [subCategoryFilter, setSubCategoryFilter] = useState('All')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [collectionFilter, setCollectionFilter] = useState('All')
  const [collections, setCollections] = useState([])
  const [importOpen, setImportOpen] = useState(false)
  const [importUploading, setImportUploading] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    getCollections({ active_only: true })
      .then(res => setCollections(res.data.data.collections || []))
      .catch(err => console.error('Error loading collections:', err))
  }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Duplicate warning states
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [potentialDuplicates, setPotentialDuplicates] = useState([])
  const [pendingPayload, setPendingPayload] = useState(null)

  const [categoryMap, setCategoryMap] = useState(FALLBACK_CATEGORY_MAP)

  useEffect(() => {
    getCategories({ active_only: true })
      .then((res) => {
        const list = res.data.data.categories || []
        if (list.length > 0) {
          const map = {}
          list.forEach(c => {
            map[c.category_name] = c.sub_categories || []
          })
          setCategoryMap(map)
        }
      })
      .catch(err => console.error('Failed to load categories:', err))
  }, [])

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
        search: debouncedSearch || undefined,
        mainCategory: categoryFilter !== 'All' ? categoryFilter : undefined,
        subCategory: subCategoryFilter !== 'All' ? subCategoryFilter : undefined,
        sortBy,
        sortOrder,
        collection_id: collectionFilter !== 'All' ? collectionFilter : undefined
      })
        .then((res) => {
          setProducts(res.data.data.products || [])
          setPagination(res.data.data.pagination || { total: 0, page: 1, totalPages: 1 })
        })
        .finally(() => setLoading(false))
    },
    [debouncedSearch, categoryFilter, subCategoryFilter, sortBy, sortOrder, collectionFilter]
  )

  useEffect(() => { load(1) }, [load])

  const visible = products

  const openCreate = () => {
    setEditing(null)
    setForm(blankForm)
    setMsg(null)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    const mainCat = p.main_category;
    const subCat = p.sub_category;
    if (mainCat) {
      setCategoryMap(prev => {
        const updated = { ...prev };
        if (!updated[mainCat]) {
          updated[mainCat] = [subCat || 'Misc'];
        } else if (subCat && !updated[mainCat].includes(subCat)) {
          updated[mainCat] = [...updated[mainCat], subCat];
        }
        return updated;
      });
    }

    setEditing(p)
    setForm({
      name: p.name,
      sku_id: p.sku_id || '',
      mainCategory: p.main_category || 'General Merchandise',
      subCategory: p.sub_category || 'Cables',
      price: String(p.price),
      purchaseCost: p.purchase_cost ? String(p.purchase_cost) : '',
      stock_quantity: String(p.stock_quantity),
      image_url: p.image_url || '',
      description: p.description || '',
      is_active: p.is_active !== false,
      product_collection_id: p.product_collection_id || '',
      deal_price: p.deal_price != null ? String(p.deal_price) : '',
      billing_name: p.billing_name || '',
      is_explicit_product: p.is_explicit_product === true
    })
    setMsg(null)
    setModalOpen(true)
  }

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
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

  const handleSubmit = async (e, bypass = false) => {
    if (e) e.preventDefault()

    // Front-end validation for collection fields
    if (form.product_collection_id) {
      const cp = parseFloat(form.deal_price)
      const rp = parseFloat(form.price)
      if (!form.deal_price || isNaN(cp) || cp <= 0) {
        notify('Deal price must be greater than zero.', 'error')
        return
      }
      if (cp >= rp) {
        notify('Deal price must be less than the regular selling price.', 'error')
        return
      }
    }

    if (form.is_explicit_product) {
      if (!form.billing_name || !form.billing_name.trim()) {
        notify('Billing Name is required for explicit products.', 'error')
        return
      }
    }

    setSaving(true)
    const payload = {
      name: form.name,
      sku_id: form.sku_id || undefined,
      mainCategory: form.mainCategory,
      subCategory: form.subCategory,
      requiredLicense: getRequiredLicense(form.mainCategory),
      price: parseFloat(form.price),
      purchase_cost: form.purchaseCost ? parseFloat(form.purchaseCost) : null,
      stock_quantity: parseInt(form.stock_quantity, 10),
      image_url: form.image_url || undefined,
      description: form.description || undefined,
      is_active: form.is_active,
      bypassDuplicateCheck: bypass,
      product_collection_id: form.product_collection_id ? parseInt(form.product_collection_id) : null,
      deal_price: form.product_collection_id && form.deal_price !== '' ? parseFloat(form.deal_price) : null,
      billing_name: form.is_explicit_product ? form.billing_name.trim() : null,
      is_explicit_product: form.is_explicit_product === true
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
        load(pagination.page)
        notify('Product created. It may appear on another page based on the current sorting.')
      }
      setModalOpen(false)
      setDuplicateModalOpen(false)
      setPendingPayload(null)
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'POTENTIAL_DUPLICATE') {
        setPotentialDuplicates(err.response.data.data.duplicates || [])
        setPendingPayload(payload)
        setDuplicateModalOpen(true)
        setModalOpen(false)
      } else {
        notify(err.response?.data?.message || 'Save failed.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleBulkImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportOpen(true);
    e.target.value = '';
  };

  const executeProductImport = async () => {
    if (!importFile) return;
    setImportUploading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('updateExisting', updateExisting);
      
      const res = await importProducts(fd);
      setImportResult(res.data);
      load(pagination.page);
      notify('Products imported successfully. New products may appear on another page based on the current sorting.');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to import products file.', 'error');
    } finally {
      setImportUploading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!importResult || !importResult.failedRows || importResult.failedRows.length === 0) return;
    
    const reportData = importResult.failedRows.map(f => {
      return {
        'Row Number': f.rowNumber,
        'Product Name': f.productName,
        'Error Reason': f.errorReason,
        ...f.rowData
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Rows');
    XLSX.writeFile(workbook, 'product_import_error_report.xlsx');
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadImportTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'wdistro_product_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('Sample import template downloaded.');
    } catch (err) {
      notify('Failed to download template from server.', 'error');
    }
  };

  const doDelete = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    try {
      await deleteProduct(p.id)
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
      setPagination((prev) => ({ ...prev, total: Math.max(0, (prev.total || 0) - 1) }))
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
    <PageLayout>
      <PageHeader
        title="Products"
        subtitle={`${pagination.total || 0} total products`}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => {
                setImportFile(null);
                setImportResult(null);
                setImportOpen(true);
              }}
              variant="outlined"
            >
              Import Products
            </Button>
            <Button onClick={openCreate}>+ Add Product</Button>
          </div>
        }
      />

      <TableToolbar>
        <FilterBar>
          {['All', ...Object.keys(categoryMap)].map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'primary' : 'secondary'}
              onClick={() => { setCategoryFilter(cat); setSubCategoryFilter('All') }}
              className="py-1 px-3 whitespace-nowrap"
            >
              {cat}
            </Button>
          ))}
        </FilterBar>
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
        />
      </TableToolbar>

      {/* Product Collection Filter Row */}
      <FilterBar className="mb-4">
        {[{ id: 'All', name: 'All Collections' }, { id: 'none', name: 'No Collection' }, ...collections].map((coll) => (
          <Button
            key={coll.id}
            variant={collectionFilter === coll.id ? 'primary' : 'secondary'}
            onClick={() => setCollectionFilter(coll.id)}
            className="py-1 px-3 whitespace-nowrap text-xs"
          >
            {coll.name}
          </Button>
        ))}
      </FilterBar>
      {categoryFilter !== 'All' && categoryMap[categoryFilter] && (
        <FilterBar className="mb-4 border-b border-gray-100 pb-2">
          {['All', ...categoryMap[categoryFilter]].map((sub) => (
            <Button
              key={sub}
              variant={subCategoryFilter === sub ? 'outlined' : 'secondary'}
              onClick={() => setSubCategoryFilter(sub)}
              className="py-0.5 px-3 whitespace-nowrap text-xs rounded-full"
            >
              {sub}
            </Button>
          ))}
        </FilterBar>
      )}


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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px] md:min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">S.No</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Image</th>
                <SortHeader label="SKU ID" sortKey="sku_id" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortHeader label="Name" sortKey="name" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                {isAdmin && <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Purchase Cost</th>}
                <SortHeader label="Price" sortKey="price" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <SortHeader label="Stock" sortKey="stock_quantity" currentSort={sortBy} currentOrder={sortOrder} onSort={handleSort} />
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="9" className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-10 text-gray-400 text-sm">No products found</td></tr>
              ) : (
                visible.map((p, index) => {
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
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{p.name}</span>
                          {p.is_clearance && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300 uppercase tracking-wide">
                              Clearance
                            </span>
                          )}
                          {p.is_active === false && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-300">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {p.main_category || 'General Merchandise'} &gt; {p.sub_category || 'Misc'}
                      </td>
                      {isAdmin && <td className="px-4 py-2.5 text-gray-500 font-medium">{p.purchase_cost ? fmt(p.purchase_cost) : '—'}</td>}
                      <td className="px-4 py-2.5 font-medium">
                        {p.deal_price != null ? (
                          <div className="flex flex-col">
                            <span className="line-through text-gray-400 text-xs">{fmt(p.price)}</span>
                            <span className="text-orange-600 font-semibold">
                              {fmt(p.deal_price)}
                              {p.ProductCollection && (
                                <span className="ml-1 bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-semibold px-1 rounded uppercase">
                                  {p.ProductCollection.name}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          fmt(p.price)
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockColor(p.stock_quantity)}`}>
                          {p.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => openEdit(p)} className="py-0.5 px-2 text-xs">Edit</Button>
                          <Button variant="danger" onClick={() => doDelete(p)} className="py-0.5 px-2 text-xs">Delete</Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button variant="secondary" onClick={() => load(pagination.page - 1)} disabled={pagination.page === 1} className="py-1 px-3">Previous</Button>
          <span className="text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
          <Button variant="secondary" onClick={() => load(pagination.page + 1)} disabled={pagination.page === pagination.totalPages} className="py-1 px-3">Next</Button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit: ${editing.name}` : 'Add Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {msg && msg.type === 'error' && (
            <div className="rounded-md bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 text-xs font-medium">
              {msg.text}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Main Category" required>
              <select
                value={form.mainCategory}
                onChange={(e) => {
                  const main = e.target.value;
                  setForm({ ...form, mainCategory: main, subCategory: '' });
                }}
                required
                className={input}
              >
                <option value="" disabled>Select category…</option>
                {Object.keys(categoryMap).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </Field>
            <Field label="Sub Category" required>
              <select
                value={form.subCategory}
                onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                required
                className={input}
                disabled={!form.mainCategory}
              >
                <option value="" disabled>{form.mainCategory ? 'Select sub category…' : 'Select a category first'}</option>
                {(categoryMap[form.mainCategory] || []).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-500 mb-1">Required License</label>
              <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold uppercase ${
                getRequiredLicense(form.mainCategory) === 'Tobacco License'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {getRequiredLicense(form.mainCategory)}
              </span>
            </div>
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
            {isAdmin && (
              <Field label="Purchase Cost ($)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.purchaseCost}
                  onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })}
                  className={input}
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={input + " h-20 resize-none"}
                  placeholder="Enter product description..."
                />
              </Field>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Product is active (visible to customers for ordering)
              </label>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="is_explicit_product"
                checked={form.is_explicit_product}
                onChange={(e) => setForm({ ...form, is_explicit_product: e.target.checked, billing_name: e.target.checked ? form.billing_name : '' })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <label htmlFor="is_explicit_product" className="text-sm font-medium text-gray-700">
                Explicit Product (Restricted to approved shops only)
              </label>
            </div>

            {form.is_explicit_product && (
              <div className="sm:col-span-2">
                <Field label="Billing Name" required>
                  <input
                    type="text"
                    value={form.billing_name}
                    onChange={(e) => setForm({ ...form, billing_name: e.target.value })}
                    required
                    className={input}
                    placeholder="Enter billing name for customer invoices"
                  />
                </Field>
              </div>
            )}

            {/* Product Collection Dropdown */}
            <div className="sm:col-span-2">
              <Field label="Product Collection">
                <select
                  value={form.product_collection_id}
                  onChange={(e) => setForm({ ...form, product_collection_id: e.target.value, deal_price: e.target.value ? form.deal_price : '' })}
                  className={input}
                >
                  <option value="">None (Regular Product)</option>
                  {collections.map((coll) => (
                    <option key={coll.id} value={coll.id}>{coll.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Deal Price — only visible when a collection is selected */}
            {form.product_collection_id && (
              <Field label="Deal Price ($)" required>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.deal_price}
                  onChange={(e) => setForm({ ...form, deal_price: e.target.value })}
                  required
                  className={input}
                  placeholder="Enter custom promotional / deal price"
                />
              </Field>
            )}
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

      {/* Duplicate Warning Modal */}
      <Modal
        open={duplicateModalOpen}
        onClose={() => { setDuplicateModalOpen(false); setModalOpen(true) }}
        title="Potential Duplicate Found"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
            A similar product already exists. Please review the existing product before creating a duplicate.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* New Product Column */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-gray-900 mb-3 border-b pb-1.5 text-sm uppercase tracking-wide">
                New Product
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block">Name:</span>
                  <span className="text-gray-900 font-semibold text-sm">{pendingPayload?.name}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Category:</span>
                  <span className="text-gray-700 font-medium">
                    {pendingPayload?.mainCategory} &gt; {pendingPayload?.subCategory}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">SKU ID:</span>
                  <span className="text-gray-700 font-mono">{pendingPayload?.sku_id || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Price:</span>
                  <span className="text-gray-900 font-semibold">{pendingPayload ? fmt(pendingPayload.price) : '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Stock:</span>
                  <span className="text-gray-700">{pendingPayload?.stock_quantity}</span>
                </div>
                {pendingPayload?.description && (
                  <div>
                    <span className="text-gray-400 font-medium block">Description:</span>
                    <p className="text-gray-600 italic line-clamp-3">{pendingPayload.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Existing Product(s) Column */}
            <div className="space-y-4">
              {potentialDuplicates.map((dup, idx) => (
                <div key={dup.id} className="border border-indigo-100 rounded-lg p-4 bg-indigo-50/30">
                  <h4 className="font-semibold text-indigo-900 mb-3 border-b border-indigo-100 pb-1.5 text-sm uppercase tracking-wide flex justify-between items-center">
                    <span>Existing Product {potentialDuplicates.length > 1 ? `#${idx + 1}` : ''}</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                      {dup.sku_id || `ID: ${dup.id}`}
                    </span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-gray-400 font-medium block">Name:</span>
                      <span className="text-gray-900 font-semibold text-sm">{dup.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium block">Category:</span>
                      <span className="text-gray-700 font-medium">
                        {dup.main_category} &gt; {dup.sub_category}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium block">SKU ID:</span>
                      <span className="text-gray-700 font-mono">{dup.sku_id || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium block">Price:</span>
                      <span className="text-gray-900 font-semibold">{fmt(dup.price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium block">Stock:</span>
                      <span className="text-gray-700">{dup.stock_quantity}</span>
                    </div>
                    {dup.description && (
                      <div>
                        <span className="text-gray-400 font-medium block">Description:</span>
                        <p className="text-gray-600 italic line-clamp-3">{dup.description}</p>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={() => handleSubmit(null, true)}
              disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 rounded-md transition-colors"
            >
              {saving ? 'Creating…' : 'Create Anyway'}
            </button>
            <button
              type="button"
              onClick={() => { setDuplicateModalOpen(false); setModalOpen(true) }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Products Wizard Modal */}
      <Modal open={importOpen} onClose={() => { if (!importUploading) setImportOpen(false) }} title="Import Products" size="lg">
        <div className="space-y-4">
          {!importResult ? (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800">
                <div className="flex justify-between items-start gap-4 mb-2 flex-wrap sm:flex-nowrap">
                  <div>
                    <p className="font-semibold mb-0.5">Standardized Template Headers & Guidelines:</p>
                    <p className="text-xs text-indigo-600">Ensure your spreadsheet contains columns mapping to the fields below.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    📥 Download Sample Template
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono mt-2">
                  <div className="p-1.5 bg-white rounded border border-indigo-100"><span className="text-red-600 font-bold">*</span> Product Name</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100"><span className="text-red-600 font-bold">*</span> SKU</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Barcode</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100"><span className="text-red-600 font-bold">*</span> Category</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100"><span className="text-red-600 font-bold">*</span> Subcategory</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Description</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Purchase Cost</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100"><span className="text-red-600 font-bold">*</span> Selling Price</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Deal Price</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Product Collection</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100"><span className="text-red-600 font-bold">*</span> Stock Quantity</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Image URL</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Featured Product (Yes/No)</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Explicit Product (Yes/No)</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Billing Name</div>
                  <div className="p-1.5 bg-white rounded border border-indigo-100">Active (Yes/No)</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="updateExisting"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="updateExisting" className="text-sm font-medium text-gray-700">
                  Update Existing Products (Overwrite matched SKU details/stock)
                </label>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 flex flex-col items-center justify-center">
                {importFile ? (
                  <>
                    <p className="text-sm text-gray-700 font-medium mb-1">
                      📄 Selected: <span className="underline">{importFile.name}</span> ({Math.round(importFile.size / 1024)} KB)
                    </p>
                    <button
                      type="button"
                      onClick={() => setImportFile(null)}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline font-medium"
                    >
                      Remove File
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-3">Drag & drop your Excel or CSV file here, or click to upload</p>
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                      📂 Select Excel / CSV File
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) setImportFile(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={executeProductImport}
                  disabled={importUploading || !importFile}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-65 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-colors"
                >
                  {importUploading ? 'Processing Import...' : 'Start Import'}
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  disabled={importUploading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Import Summary Results:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <div className="text-2xl font-bold text-gray-800">{importResult.summary.totalRows}</div>
                  <div className="text-2xs text-gray-400 uppercase tracking-wider mt-0.5">Total Rows</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-150 text-center">
                  <div className="text-2xl font-bold text-green-700">{importResult.summary.productsCreated}</div>
                  <div className="text-2xs text-green-500 uppercase tracking-wider mt-0.5">Created</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-150 text-center">
                  <div className="text-2xl font-bold text-blue-700">{importResult.summary.productsUpdated}</div>
                  <div className="text-2xs text-blue-500 uppercase tracking-wider mt-0.5">Updated</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-150 text-center">
                  <div className="text-2xl font-bold text-red-700">{importResult.summary.failedRowsCount}</div>
                  <div className="text-2xs text-red-500 uppercase tracking-wider mt-0.5">Failed Rows</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <span className="font-semibold text-gray-600">Categories:</span> Created: {importResult.summary.categoriesCreated} | Normalized: {importResult.summary.categoriesNormalized}
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Subcategories:</span> Created: {importResult.summary.subcategoriesCreated} | Normalized: {importResult.summary.subcategoriesNormalized}
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Collections:</span> Created: {importResult.summary.collectionsCreated} | Normalized: {importResult.summary.collectionsNormalized}
                </div>
              </div>

              {importResult.failedRows && importResult.failedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold text-red-700">Failed Items Details ({importResult.failedRows.length}):</h4>
                    <button
                      type="button"
                      onClick={downloadErrorReport}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline flex items-center gap-1"
                    >
                      📥 Download Error Report
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-red-100 rounded-md">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-red-50 text-red-800 border-b border-red-100">
                          <th className="p-2 w-16">Row</th>
                          <th className="p-2 w-1/3">Product Name</th>
                          <th className="p-2">Error Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.failedRows.map((f, idx) => (
                          <tr key={idx} className="border-b border-red-50 hover:bg-red-50/30">
                            <td className="p-2 font-mono text-gray-500">{f.rowNumber}</td>
                            <td className="p-2 font-medium text-gray-700">{f.productName}</td>
                            <td className="p-2 text-red-600">{f.errorReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button onClick={() => setImportOpen(false)} className="w-full">
                  Close & Refresh List
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </PageLayout>
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

function SortHeader({ label, sortKey, currentSort, currentOrder, onSort }) {
  const isSorted = currentSort === sortKey
  return (
    <th 
      onClick={() => onSort(sortKey)}
      className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors select-none"
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">
          {isSorted ? (currentOrder === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </div>
    </th>
  )
}
