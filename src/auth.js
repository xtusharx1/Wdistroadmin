const KEY = 'wdistro_user'

export const getUser = () => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const setUser = (user) => localStorage.setItem(KEY, JSON.stringify(user))
export const clearUser = () => localStorage.removeItem(KEY)
