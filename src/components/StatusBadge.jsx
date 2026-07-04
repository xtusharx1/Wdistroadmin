import React from 'react'

const BADGE_STYLES = {
  // Order statuses
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  processed: 'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Approval statuses
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',

  // Payment statuses
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  settled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid: 'bg-orange-50 text-orange-700 border-orange-200',
  unsettled: 'bg-yellow-50 text-yellow-700 border-yellow-250',
  unpaid: 'bg-rose-50 text-rose-700 border-rose-200',

  // User / shop state
  true: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  false: 'bg-gray-50 text-gray-500 border-gray-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',

  // Stock status
  in_stock: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-rose-50 text-rose-700 border-rose-200',

  // Promotional
  clearance: 'bg-orange-50 text-orange-700 border-orange-200',
  deals: 'bg-orange-50 text-orange-700 border-orange-200',
  featured: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

export default function StatusBadge({ status, type = 'order' }) {
  // Normalize string statuses
  const normalized = String(status).trim()
  
  let label = normalized
  let styleKey = normalized

  if (type === 'user') {
    const isActive = normalized === 'true' || normalized === 'active'
    label = isActive ? 'Active' : 'Inactive'
    styleKey = String(isActive)
  } else if (type === 'payment') {
    if (normalized === 'partially_paid') label = 'Partially Paid'
    else if (normalized === 'paid' || normalized === 'settled') label = 'Paid'
    else if (normalized === 'unsettled' || normalized === 'unpaid') label = 'Unsettled'
  } else if (type === 'stock') {
    if (normalized === 'low_stock') label = 'Low Stock'
    else if (normalized === 'out_of_stock') label = 'Out of Stock'
    else label = 'In Stock'
  }

  const classes = BADGE_STYLES[styleKey] || 'bg-gray-50 text-gray-650 border-gray-200'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-4xs font-semibold border uppercase tracking-wider ${classes}`}
    >
      {label}
    </span>
  )
}
