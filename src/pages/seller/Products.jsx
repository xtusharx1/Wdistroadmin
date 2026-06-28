import { useState, useEffect, useCallback } from 'react'
import { getProducts, createProduct, bulkCreateProducts, updateProduct, deleteProduct, uploadImage } from '../../api'
import { getUser } from '../../auth'
import Modal from '../../components/Modal'
import * as XLSX from 'xlsx'

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US')}`
const input = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

const CATEGORY_MAP = {
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

const blankForm = { name: '', sku_id: '', mainCategory: 'General Merchandise', subCategory: 'Cables', price: '', purchaseCost: '', stock_quantity: '', image_url: '', description: '', is_active: true }

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

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Duplicate warning states
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [potentialDuplicates, setPotentialDuplicates] = useState([])
  const [pendingPayload, setPendingPayload] = useState(null)

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
        sortOrder
      })
        .then((res) => {
          setProducts(res.data.data.products || [])
          setPagination(res.data.data.pagination || { total: 0, page: 1, totalPages: 1 })
        })
        .finally(() => setLoading(false))
    },
    [debouncedSearch, categoryFilter, subCategoryFilter, sortBy, sortOrder]
  )

  useEffect(() => { load(1) }, [load])

  const visible = products

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
      mainCategory: p.main_category || 'General Merchandise',
      subCategory: p.sub_category || 'Cables',
      price: String(p.price),
      purchaseCost: p.purchase_cost ? String(p.purchase_cost) : '',
      stock_quantity: String(p.stock_quantity),
      image_url: p.image_url || '',
      description: p.description || '',
      is_active: p.is_active !== false
    })
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
      bypassDuplicateCheck: bypass
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
      setDuplicateModalOpen(false)
      setPendingPayload(null)
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'POTENTIAL_DUPLICATE') {
        setPotentialDuplicates(err.response.data.data.duplicates || [])
        setPendingPayload(payload)
        setDuplicateModalOpen(true)
      } else {
        notify(err.response?.data?.message || 'Save failed.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleBulkImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet)
        
        const mappedProducts = rows.map((row) => {
          const findVal = (keys) => {
            const normalizedKeys = keys.map(k => String(k).replace(/[^a-z0-9]/g, '').toLowerCase());
            const match = Object.keys(row).find(k => {
              const normK = String(k).replace(/[^a-z0-9]/g, '').toLowerCase();
              return normalizedKeys.includes(normK);
            });
            return match !== undefined ? row[match] : undefined;
          };
          
          const pName = findVal([
            'product/service name', 'name', 'product name', 'service name', 'title',
            'product title', 'product_name', 'service_name', 'item', 'item name', 'item_name',
            'product', 'description', 'desc'
          ]);
          const pSku = findVal([
            'sku', 'sku id', 'sku_id', 'product code', 'product_code', 'code',
            'item code', 'item_code', 'id', 'sku_number', 'skunumber', 'barcode', 'upc', 'ean'
          ]);
          const pPrice = findVal([
            'sales price / rate', 'price', 'sales price', 'rate', 'selling price',
            'selling_price', 'sales_price', 'unit price', 'unit_price', 'retail price',
            'retail_price', 'value'
          ]);
          const pCost = findVal([
            'purchase cost', 'purchase_cost', 'cost', 'purchase_price', 'purchase price',
            'cost price', 'cost_price', 'unit cost', 'unit_cost', 'buy price', 'buy_price',
            'purchasecost', 'costprice'
          ]);
          const pQty = findVal([
            'quantity on hand', 'stock_quantity', 'stock', 'qty', 'quantity',
            'qty on hand', 'qty_on_hand', 'quantity_on_hand', 'inventory', 'in stock',
            'instock', 'stock qty', 'stock_qty', 'count', 'quantityonhand', 'qtyonhand',
            'avail', 'available', 'available qty', 'available quantity', 'available_qty',
            'available_quantity', 'on hand', 'on_hand', 'onhand'
          ]);
          
          const pMainCategory = findVal(['main category', 'main_category', 'category', 'class']);
          const pSubCategory = findVal(['sub category', 'sub_category', 'subcategory']);
          
          const pDesc = findVal(['description', 'desc', 'product description', 'item description', 'details', 'detail']);
          
          let mainCat = 'General Merchandise';
          let subCat = 'Misc';
          
          if (pMainCategory) {
            const cleanedMain = String(pMainCategory).trim().toLowerCase();
            const matchedKey = Object.keys(CATEGORY_MAP).find(
              (key) => key.toLowerCase() === cleanedMain
            );
            if (matchedKey) {
              mainCat = matchedKey;
              subCat = CATEGORY_MAP[matchedKey][0] || 'Misc';
              
              if (pSubCategory) {
                const cleanedSub = String(pSubCategory).trim().toLowerCase();
                const matchedSub = CATEGORY_MAP[matchedKey].find(
                  (sub) => sub.toLowerCase() === cleanedSub
                );
                if (matchedSub) {
                  subCat = matchedSub;
                } else {
                  subCat = String(pSubCategory).trim();
                }
              } else {
                // Main category matched, but subcategory is missing. Use keyword mapping to refine it.
                const detected = mapCategoryFromText(pName, pDesc, pMainCategory, pSubCategory);
                if (detected.mainCat === matchedKey) {
                  subCat = detected.subCat;
                }
              }
            } else {
              // Check if the main category column actually matches a subcategory
              let foundMatch = false;
              for (const [key, subs] of Object.entries(CATEGORY_MAP)) {
                const matchedSub = subs.find(sub => sub.toLowerCase() === cleanedMain);
                if (matchedSub) {
                  mainCat = key;
                  subCat = matchedSub;
                  foundMatch = true;
                  break;
                }
              }
              if (!foundMatch) {
                // If it didn't match main or sub, try keyword detection
                const detected = mapCategoryFromText(pName, pDesc, pMainCategory, pSubCategory);
                if (detected.mainCat !== 'General Merchandise' || detected.subCat !== 'Misc') {
                  mainCat = detected.mainCat;
                  subCat = detected.subCat;
                } else {
                  mainCat = String(pMainCategory).trim();
                  subCat = pSubCategory ? String(pSubCategory).trim() : 'Misc';
                }
              }
            }
          } else {
            // No main category specified. Try keyword detection first
            const detected = mapCategoryFromText(pName, pDesc, pMainCategory, pSubCategory);
            if (detected.mainCat !== 'General Merchandise' || detected.subCat !== 'Misc') {
              mainCat = detected.mainCat;
              subCat = detected.subCat;
            } else if (categoryFilter !== 'All') {
              mainCat = categoryFilter;
              subCat = CATEGORY_MAP[categoryFilter]?.[0] || 'Misc';
            }
          }
          
          let parsedQty = 0;
          if (pQty !== undefined && pQty !== null && pQty !== '') {
            const num = Math.round(Number(pQty));
            if (!isNaN(num)) {
              parsedQty = num;
            }
          }

          let parsedPrice = NaN;
          if (pPrice !== undefined && pPrice !== null && pPrice !== '') {
            const num = parseFloat(pPrice);
            if (!isNaN(num)) {
              parsedPrice = num;
            }
          }

          let parsedCost = null;
          if (pCost !== undefined && pCost !== null && pCost !== '') {
            const num = parseFloat(pCost);
            if (!isNaN(num)) {
              parsedCost = num;
            }
          }
          
          return {
            name: pName ? String(pName).trim() : '',
            sku_id: pSku ? String(pSku).trim() : null,
            price: parsedPrice,
            purchase_cost: parsedCost,
            stock_quantity: parsedQty,
            mainCategory: mainCat,
            subCategory: subCat,
            requiredLicense: getRequiredLicense(mainCat),
            description: pDesc ? String(pDesc).trim() : null
          };
        }).filter(p => p.name && !isNaN(p.price));
        
        if (mappedProducts.length === 0) {
          notify('No valid products found in the sheet. Ensure headers match "Product/Service Name" and "Sales Price / Rate".', 'error')
          return
        }
        
        await bulkCreateProducts(mappedProducts)
        load(1)
        notify(`${mappedProducts.length} products imported successfully.`)
      } catch (err) {
        notify(err.response?.data?.message || 'Failed to parse or import Excel file.', 'error')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
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
          <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer inline-flex items-center">
            Import Excel/CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleBulkImport}
              className="hidden"
            />
          </label>
          <button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            + Add Product
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {['All', ...Object.keys(CATEGORY_MAP)].map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setCategoryFilter(cat)
              setSubCategoryFilter('All')
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              categoryFilter === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {categoryFilter !== 'All' && CATEGORY_MAP[categoryFilter] && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1.5 border-b border-gray-100">
          {['All', ...CATEGORY_MAP[categoryFilter]].map((sub) => (
            <button
              key={sub}
              onClick={() => setSubCategoryFilter(sub)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                subCategoryFilter === sub
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-10">Loading…</p>
        ) : (
          <>
            <table className="w-full text-sm">
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
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
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
            <Field label="Main Category" required>
              <select
                value={form.mainCategory}
                onChange={(e) => {
                  const main = e.target.value;
                  const subs = CATEGORY_MAP[main] || [];
                  setForm({ ...form, mainCategory: main, subCategory: subs[0] || '' });
                }}
                required
                className={input}
              >
                {Object.keys(CATEGORY_MAP).map((cat) => (
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
              >
                {(CATEGORY_MAP[form.mainCategory] || []).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
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
            <div className="col-span-2">
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={input + " h-20 resize-none"}
                  placeholder="Enter product description..."
                />
              </Field>
            </div>
            <div className="col-span-2 flex items-center gap-2 py-1">
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
        onClose={() => setDuplicateModalOpen(false)}
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
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicateModalOpen(false)
                          setModalOpen(false)
                          openEdit(dup)
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors w-full"
                      >
                        View Existing Product
                      </button>
                    </div>
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
              onClick={() => setDuplicateModalOpen(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
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
