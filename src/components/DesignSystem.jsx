import React from 'react'

// PageLayout wrapper
export function PageLayout({ children, className = '' }) {
  return (
    <div className={`p-4 sm:p-6 max-w-7xl mx-auto space-y-6 ${className}`}>
      {children}
    </div>
  )
}

// PageHeader component
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-150">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-1 font-medium">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">{action}</div>}
    </div>
  )
}

// SectionCard container
export function SectionCard({ children, title, action, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          {title && <h3 className="font-bold text-sm text-gray-900">{title}</h3>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

// Button styles helper
const baseButton = 'inline-flex items-center justify-center font-semibold text-xs px-3.5 py-2 rounded-lg shadow-2xs transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
const buttonVariants = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white focus-visible:ring-indigo-500',
  secondary: 'bg-white border border-gray-350 hover:bg-gray-50 text-gray-700 focus-visible:ring-indigo-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white focus-visible:ring-amber-500',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500',
  outlined: 'bg-transparent border border-indigo-200 hover:bg-indigo-50/50 text-indigo-700 focus-visible:ring-indigo-500',
  text: 'bg-transparent hover:bg-gray-100 text-gray-700 shadow-none border-none'
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={`${baseButton} ${buttonVariants[variant] || buttonVariants.primary} ${className}`}
      {...props}
    />
  )
}

// IconButton
export function IconButton({ children, variant = 'secondary', className = '', ...props }) {
  return (
    <button
      className={`p-1.5 rounded-lg border transition-all duration-150 focus:outline-none focus-visible:ring-2 ${
        variant === 'danger'
          ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200 focus-visible:ring-red-500'
          : variant === 'primary'
          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 focus-visible:ring-indigo-500'
          : 'bg-white hover:bg-gray-50 text-gray-500 border-gray-250 focus-visible:ring-indigo-500'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// SearchBar input
export function SearchBar({ value, onChange, placeholder = 'Search...', className = '', ...props }) {
  return (
    <div className={`relative flex-1 max-w-md ${className}`}>
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-gray-800 placeholder-gray-450 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-150"
        {...props}
      />
    </div>
  )
}

// FilterBar container
export function FilterBar({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-3 flex-wrap overflow-x-auto pb-0.5 ${className}`}>
      {children}
    </div>
  )
}

// TableToolbar
export function TableToolbar({ children, className = '' }) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-2xs ${className}`}>
      {children}
    </div>
  )
}

// LoadingState spinner
export function LoadingState({ message = 'Loading records...', height = 'h-64' }) {
  return (
    <div className={`flex flex-col items-center justify-center ${height} text-center space-y-3`}>
      <svg className="animate-spin h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="text-xs font-semibold text-gray-500">{message}</span>
    </div>
  )
}

// EmptyState component
export function EmptyState({ title = 'No results found', subtitle = 'Try adjusting your search query or filters.', icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-center">
      <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3.5">
        {icon || (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2m4.586-1H12m0 0l-2-2m2 2l-2 2m4-2H12" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-bold text-gray-700">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-1 mb-4 font-medium max-w-xs">{subtitle}</p>}
      {action}
    </div>
  )
}

// DataTable component
export function DataTable({ headers = [], children, empty, loading }) {
  if (loading) return <LoadingState />
  if (empty) return <EmptyState />

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[800px] md:min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600 uppercase tracking-wide">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 font-bold text-4xs ${
                    h.align === 'center' ? 'text-center' : h.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  style={h.width ? { width: h.width } : undefined}
                >
                  {h.label || h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 text-gray-700">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Pagination controls
export function Pagination({ current, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-150 shrink-0">
      <span className="text-4xs font-bold text-gray-400 uppercase tracking-wider">
        Page {current} of {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          className="py-1 px-2.5 font-bold"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          className="py-1 px-2.5 font-bold"
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

// Form field standardized layout helper
export function Field({ label, required, children, error, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-2xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-0.5">
          {label}
          {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      {children}
      {error && <span className="text-3xs font-semibold text-red-600 mt-0.5">{error}</span>}
    </div>
  )
}

// Standardized Modal Dialog container
export function Dialog({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null

  const widths = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }

  return (
    <div
      className="fixed inset-0 bg-black/45 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-white w-full ${widths[size]} max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl shadow-xl border border-gray-250/20`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-150 shrink-0">
          <h2 className="text-sm font-bold text-gray-900 pr-4 truncate uppercase tracking-wider">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none w-6 h-6 flex items-center justify-center shrink-0 rounded hover:bg-gray-100 transition-colors"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

// Confirmation modal dialog
export function ConfirmationDialog({ open, onClose, title, message, onConfirm, confirmText = 'Confirm', confirmVariant = 'danger', loading }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-xs text-gray-600 font-medium leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
