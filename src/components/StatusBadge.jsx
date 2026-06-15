const ORDER_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  processed: 'bg-blue-100 text-blue-800',
  dispatched: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
}

const APPROVAL_STYLES = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
}

const USER_STYLES = {
  true: 'bg-green-100 text-green-700',
  false: 'bg-gray-100 text-gray-500',
}

export default function StatusBadge({ status, type = 'order' }) {
  const styles =
    type === 'approval'
      ? APPROVAL_STYLES
      : type === 'user'
      ? USER_STYLES
      : ORDER_STYLES

  const label =
    type === 'user' ? (status ? 'Active' : 'Inactive') : status

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {label}
    </span>
  )
}
