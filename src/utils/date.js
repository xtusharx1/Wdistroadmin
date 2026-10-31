/**
 * Unified Date and Time Formatting Utilities
 * Standardized to MM/DD/YYYY (and MMDDYYYY where no separators are used)
 */

const LA_TZ = 'America/Los_Angeles'

/**
 * Formats a date into MM/DD/YYYY format.
 * If date is null or invalid, returns fallback (default '—').
 * Handles ISO strings, Date objects, timestamps, and YYYY-MM-DD date strings.
 * Prevents unintended day shifts caused by timezone conversion on date-only strings.
 */
export const fmtDate = (d, fallback = '—') => {
  if (!d) return fallback
  if (typeof d === 'string') {
    const trimmed = d.trim()
    // Handle pure YYYY-MM-DD strings without time component
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, day] = trimmed.split('-')
      return `${m}/${day}/${y}`
    }
  }
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return fallback
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  }).format(dt)
}

/**
 * Formats a date without separators: MMDDYYYY
 */
export const fmtDateNoSep = (d, fallback = '—') => {
  const formatted = fmtDate(d, fallback)
  if (formatted === fallback) return fallback
  return formatted.replace(/\//g, '')
}

/**
 * Formats a date and time into MM/DD/YYYY, hh:mm AM/PM
 */
export const fmtTime = (d, fallback = '—') => {
  if (!d) return fallback
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return fallback
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(dt)
}

/**
 * Formats a date and time with seconds: MM/DD/YYYY, hh:mm:ss AM/PM
 */
export const fmtDateTimeWithSeconds = (d, fallback = '—') => {
  if (!d) return fallback
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return fallback
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LA_TZ,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(dt)
}

/**
 * Safe parser that accepts MM/DD/YYYY, MMDDYYYY, YYYY-MM-DD, or ISO strings
 * Returns a valid Date object or null.
 * Properly validates day > 12 to detect swapped date values.
 */
export const parseDateSafe = (str) => {
  if (!str) return null
  if (str instanceof Date) return isNaN(str.getTime()) ? null : str
  const trimmed = String(str).trim()

  // MMDDYYYY (8 digits without separator)
  if (/^\d{8}$/.test(trimmed)) {
    const month = parseInt(trimmed.slice(0, 2), 10)
    const day = parseInt(trimmed.slice(2, 4), 10)
    const year = parseInt(trimmed.slice(4, 8), 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const dt = new Date(year, month - 1, day)
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return dt
    }
    return null
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10)
    const day = parseInt(mdyMatch[2], 10)
    const year = parseInt(mdyMatch[3], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const dt = new Date(year, month - 1, day)
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return dt
    }
    return null
  }

  // YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10)
    const day = parseInt(ymdMatch[3], 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const dt = new Date(year, month - 1, day)
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return dt
    }
    return null
  }

  const dt = new Date(trimmed)
  return isNaN(dt.getTime()) ? null : dt
}
