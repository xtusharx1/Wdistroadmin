import { useState, useEffect, useCallback } from 'react'
import { getStoreBalance, getStoreOrderBalances, getStoreOrderTimeline, getStorePayments, getStoreCreditNotes } from '../../api'
import { Dialog } from '../../components/DesignSystem'
import { fmtDate } from '../../utils/date'

const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ORDER_STATUS = {
  paid: ['Paid', 'bg-green-50 text-green-700 border-green-200'],
  partially_paid: ['Partly paid', 'bg-orange-50 text-orange-700 border-orange-200'],
  unpaid: ['Unpaid', 'bg-red-50 text-red-700 border-red-200'],
}
const CREDIT_STATUS = {
  Available: 'bg-green-50 text-green-700 border-green-200',
  'Partially Used': 'bg-orange-50 text-orange-700 border-orange-200',
  'Fully Used': 'bg-gray-50 text-gray-600 border-gray-200',
}
const Pill = ({ cls, children }) => (
  <span className={`inline-flex text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${cls}`}>{children}</span>
)

// Compact net position for the stores table
export function StoreBalanceBadge({ balance }) {
  if (!balance) return <span className="text-xs text-gray-400">—</span>
  if (balance.net_position === 'store_owes_us') {
    return <span className="text-xs font-semibold text-orange-700">Owes us {money(balance.net_balance)}</span>
  }
  if (balance.net_position === 'we_owe_store') {
    return <span className="text-xs font-semibold text-indigo-700">We owe {money(balance.net_balance)}</span>
  }
  return <span className="text-xs font-medium text-gray-500">Settled</span>
}

export default function StoreAccountDialog({ store, onClose }) {
  const [balance, setBalance] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('invoices')

  useEffect(() => {
    getStoreBalance(store.id)
      .then((res) => setBalance(res.data.data.balance))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load the store balance.'))
  }, [store.id])

  return (
    <Dialog open onClose={onClose} title={`Account — ${store.shop_name}`} size="xl">
      {error ? (
        <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
      ) : !balance ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading balance…</p>
      ) : (
        <div className="space-y-5">
          <NetBanner balance={balance} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Receivable · store owes us</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">{money(balance.receivable)}</p>
              <dl className="mt-3 space-y-1 text-xs">
                <Line label="Total invoiced" value={money(balance.total_invoiced)} />
                <Line label="− Payments applied to invoices" value={money(balance.payments_applied ?? (balance.total_payments - balance.overpayments))} />
                <Line label="− Credits applied to invoices" value={money(balance.total_credits_applied)} />
              </dl>
              <p className="text-[11px] text-orange-700/80 mt-2">
                Summed per invoice, never below $0 · {balance.open_invoice_count} of {balance.invoice_count} invoice{balance.invoice_count === 1 ? '' : 's'} open
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Payable · we owe the store</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">{money(balance.payable)}</p>
              <dl className="mt-3 space-y-1 text-xs">
                <Line label="Unused credit-note balance" value={money(balance.available_credit)} />
                <Line label="+ Overpayments on invoices" value={money(balance.overpayments)} />
              </dl>
              <p className="text-[11px] text-indigo-700/80 mt-2">
                Credits issued {money(balance.total_credits_issued)} · applied {money(balance.total_credits_applied)} · {balance.open_credit_note_count} note{balance.open_credit_note_count === 1 ? '' : 's'} with credit left
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Total invoiced" value={money(balance.total_invoiced)} />
            <Stat label="Payments received" value={money(balance.total_payments)} cls="text-green-700" />
            <Stat label="Credits issued" value={money(balance.total_credits_issued)} cls="text-indigo-700" />
            <Stat label="Credits applied" value={money(balance.total_credits_applied)} cls="text-indigo-700" />
          </div>

          <div>
            <div className="flex border-b border-gray-200 mb-3">
              {[['invoices', `Invoices (${balance.invoice_count})`], ['payments', 'Payments'], ['credits', `Credit Notes (${balance.credit_note_count})`]].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'invoices' && <InvoicesTab shopId={store.id} />}
            {tab === 'payments' && <PaymentsTab shopId={store.id} />}
            {tab === 'credits' && <CreditNotesTab shopId={store.id} />}
          </div>
        </div>
      )}
    </Dialog>
  )
}

function NetBanner({ balance }) {
  const { net_position: pos, net_balance: net } = balance
  const [cls, title, text] = pos === 'store_owes_us'
    ? ['bg-orange-600 text-white', `Store owes us ${money(net)}`, 'Receivable is greater than payable.']
    : pos === 'we_owe_store'
      ? ['bg-indigo-600 text-white', `We owe the store ${money(net)}`, 'Payable is greater than receivable.']
      : ['bg-gray-100 text-gray-800', 'Account settled', 'Receivable and payable are equal.']
  return (
    <div className={`rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${cls}`}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Net balance</p>
        <p className="text-lg font-bold">{title}</p>
      </div>
      <p className="text-xs opacity-90">{text} {money(balance.receivable)} receivable − {money(balance.payable)} payable</p>
    </div>
  )
}

const Line = ({ label, value }) => (
  <div className="flex justify-between gap-3"><dt className="text-gray-600">{label}</dt><dd className="font-semibold text-gray-800">{value}</dd></div>
)
const Stat = ({ label, value, cls = 'text-gray-900' }) => (
  <div className="rounded-lg bg-gray-50 border border-gray-150 px-3 py-2">
    <p className="text-gray-500">{label}</p>
    <p className={`font-bold mt-0.5 ${cls}`}>{value}</p>
  </div>
)

// Generic "load more" pager over an endpoint returning { items, has_more }
function usePaged(fetchPage, deps) {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [extra, setExtra] = useState(null)

  const load = useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const next = reset ? 1 : page + 1
      const res = await fetchPage(next)
      setItems((prev) => (reset ? res.items : [...prev, ...res.items]))
      setHasMore(res.hasMore)
      setExtra(res.extra || null)
      setPage(next)
    } finally {
      setLoading(false)
    }
  }, [fetchPage, page])

  useEffect(() => { load(true) }, deps)
  return { items, hasMore, loading, extra, loadMore: () => load(false) }
}

const LoadMore = ({ pager }) => (
  pager.loading ? <p className="text-xs text-gray-400 py-3 text-center">Loading…</p>
    : pager.hasMore ? (
      <div className="text-center py-2">
        <button onClick={pager.loadMore} className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium">Load more</button>
      </div>
    ) : null
)

function InvoicesTab({ shopId }) {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchPage = useCallback(async (page) => {
    const res = await getStoreOrderBalances(shopId, { status, search: query, page, limit: 20 })
    const d = res.data.data
    return { items: d.orders, hasMore: d.pagination.has_more, extra: d.counts }
  }, [shopId, status, query])
  const pager = usePaged(fetchPage, [shopId, status, query])
  const counts = pager.extra

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([key, label]) => (
          <button key={key} onClick={() => setStatus(key)}
            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${status === key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {label}{counts ? ` (${counts[key]})` : ''}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order / invoice #"
          className="ml-auto w-44 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Invoice', 'Order date', 'Billed', 'Paid', 'Credited', 'Outstanding', 'Status'].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pager.items.map((o) => (
              <InvoiceRow key={o.invoice_id} shopId={shopId} order={o} open={open === o.order_id} onToggle={() => setOpen(open === o.order_id ? null : o.order_id)} />
            ))}
            {!pager.loading && pager.items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No invoices match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <LoadMore pager={pager} />
    </div>
  )
}

function InvoiceRow({ shopId, order, open, onToggle }) {
  const [timeline, setTimeline] = useState(null)
  useEffect(() => {
    if (open && !timeline) {
      getStoreOrderTimeline(shopId, order.order_id).then((res) => setTimeline(res.data.data.timeline)).catch(() => setTimeline([]))
    }
  }, [open, timeline, shopId, order.order_id])
  const [label, cls] = ORDER_STATUS[order.status] || ORDER_STATUS.unpaid
  return (
    <>
      <tr onClick={onToggle} className="hover:bg-gray-50 cursor-pointer">
        <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{open ? '▾' : '▸'} {order.invoice_number} <span className="font-normal text-gray-400">· {order.order_number}</span></td>
        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(order.order_date)}</td>
        <td className="px-3 py-2.5">{money(order.total)}</td>
        <td className="px-3 py-2.5 text-green-700">{money(order.paid)}</td>
        <td className="px-3 py-2.5 text-indigo-700">{money(order.credited)}</td>
        <td className="px-3 py-2.5 font-semibold text-orange-700">{money(order.outstanding)}</td>
        <td className="px-3 py-2.5"><Pill cls={cls}>{label}</Pill></td>
      </tr>
      {open && (
        <tr className="bg-gray-50/60">
          <td colSpan={7} className="px-6 py-3">
            {!timeline ? <p className="text-xs text-gray-400">Loading…</p> : (
              <table className="w-full text-xs">
                <tbody>
                  {timeline.map((e, i) => (
                    <tr key={i}>
                      <td className="py-1 text-gray-500 w-28">{fmtDate(e.date)}</td>
                      <td className="py-1 text-gray-700">
                        {e.type === 'invoice' ? 'Invoice billed'
                          : e.type === 'credit' ? `Credit note ${e.credit_note_number || ''} applied (not cash)`
                            : `Payment · ${e.payment_method === 'MO' ? 'Money Order' : e.payment_method}${e.reference_no ? ` · ${e.reference_no}` : ''}${e.remarks ? ` · ${e.remarks}` : ''}`}
                      </td>
                      <td className={`py-1 text-right font-semibold ${e.type === 'invoice' ? 'text-gray-800' : e.type === 'credit' ? 'text-indigo-700' : 'text-green-700'}`}>
                        {e.type === 'invoice' ? money(e.amount) : `−${money(e.amount)}`}
                      </td>
                      <td className="py-1 text-right text-gray-400 w-32">balance {money(e.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function PaymentsTab({ shopId }) {
  const fetchPage = useCallback(async (page) => {
    const res = await getStorePayments(shopId, { page, limit: 20 })
    const d = res.data.data
    return { items: d.payments, hasMore: d.pagination.has_more, extra: { total: d.pagination.total } }
  }, [shopId])
  const pager = usePaged(fetchPage, [shopId])
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Cash, card, check and money-order payments only. Credit notes are shown under Credit Notes and on each invoice.</p>
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Date', 'Invoice', 'Method', 'Amount', 'Ref No', 'Remarks', 'Recorded by'].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pager.items.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{p.invoice_number}</td>
                <td className="px-3 py-2">{p.payment_method === 'MO' ? 'Money Order' : p.payment_method}</td>
                <td className="px-3 py-2 font-semibold text-green-700">{money(p.amount)}</td>
                <td className="px-3 py-2 font-mono text-gray-500">{p.reference_no || '—'}</td>
                <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{p.remarks || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{p.recorded_by || '—'}</td>
              </tr>
            ))}
            {!pager.loading && pager.items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No payments recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <LoadMore pager={pager} />
    </div>
  )
}

function CreditNotesTab({ shopId }) {
  const [notes, setNotes] = useState(null)
  useEffect(() => {
    getStoreCreditNotes(shopId).then((res) => setNotes(res.data.data.credit_notes)).catch(() => setNotes([]))
  }, [shopId])
  if (!notes) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
  if (notes.length === 0) return <p className="text-xs text-gray-400 py-6 text-center">No credit notes for this store.</p>
  return (
    <div className="border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>{['Credit note', 'From', 'Issued', 'Amount', 'Used', 'Remaining', 'Status', 'Used on', 'PDF'].map((h) => (
            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {notes.map((n) => (
            <tr key={n.id} className="align-top">
              <td className="px-3 py-2 font-semibold text-gray-900">{n.credit_note_number}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{n.invoice_number} · {n.order_number}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(n.issued_at)}</td>
              <td className="px-3 py-2 font-medium">{money(n.amount)}</td>
              <td className="px-3 py-2">{money(n.used_amount)}</td>
              <td className="px-3 py-2 font-semibold text-indigo-700">{money(n.remaining_amount)}</td>
              <td className="px-3 py-2"><Pill cls={CREDIT_STATUS[n.status] || CREDIT_STATUS['Fully Used']}>{n.status}</Pill></td>
              <td className="px-3 py-2 text-gray-500">
                {n.usage.length === 0 ? '—' : n.usage.map((u, i) => <div key={i} className="whitespace-nowrap">{u.invoice_number}: {money(u.amount)}</div>)}
              </td>
              <td className="px-3 py-2">
                {n.pdf_url ? <a href={n.pdf_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-medium">View</a> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
