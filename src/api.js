import axios from 'axios'
import { getUser } from './auth'

const http = axios.create({
  baseURL:
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'http://ec2-184-169-137-142.us-west-1.compute.amazonaws.com:3000',
})

http.interceptors.request.use((config) => {
  const user = getUser()
  if (user) {
    config.headers['x-user-id'] = user.id
    config.headers['x-user-role'] = user.role
  }
  return config
})

// ── Auth ────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  http.post('/auth/user/login', { email, password })

export const changePassword = (email, currentPassword, newPassword) =>
  http.post('/auth/user/change-password', { email, currentPassword, newPassword })

export const resetPassword = (email, newPassword) =>
  http.post('/auth/user/reset-password', { email, newPassword })

export const resetShopPassword = (email, newPassword) =>
  http.post('/auth/shop/reset-password', { email, newPassword })

// ── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardStats = () => http.get('/dashboard/stats')

// ── Users ───────────────────────────────────────────────────────────────────
export const getUsers = () => http.get('/users')
export const createUser = (data) => http.post('/users', data)
export const activateUser = (id) => http.patch(`/users/${id}/approve`)
export const deactivateUser = (id) => http.patch(`/users/${id}/reject`)
export const updateUser = (id, data) => http.patch(`/users/${id}`, data)

// ── Shops ───────────────────────────────────────────────────────────────────
export const getShops = () => http.get('/shops')
export const approveShop = (id) => http.patch(`/shops/${id}/approve`)
export const rejectShop = (id) => http.patch(`/shops/${id}/reject`)
export const updateShop = (id, data) => http.patch(`/shops/${id}`, data)

// ── Products ────────────────────────────────────────────────────────────────
export const getProducts = (params) => http.get('/products', { params })
export const createProduct = (data) => http.post('/products', data)
export const bulkCreateProducts = (data) => http.post('/products/bulk', data)
export const updateProduct = (id, data) => http.patch(`/products/${id}`, data)
export const updateStock = (id, stock_quantity) =>
  http.patch(`/products/${id}/stock`, { stock_quantity })
export const deleteProduct = (id) => http.delete(`/products/${id}`)
export const uploadImage = (formData) =>
  http.post('/products/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// ── Orders ──────────────────────────────────────────────────────────────────
export const getOrders = () => http.get('/orders')
export const processOrder = (id, items) =>
  http.patch(`/orders/${id}/process`, { items })
export const updateOrderStatus = (id, status) =>
  http.patch(`/orders/${id}/status`, { status })

// ── Invoices ────────────────────────────────────────────────────────────────
export const getInvoice = (orderId) => http.get(`/invoices/${orderId}`)
export const generateInvoice = (orderId) => http.post(`/invoices/${orderId}/generate`)
export const regenerateInvoice = (invoiceId) => http.post(`/invoices/${invoiceId}/regenerate`)

// ── Sales ───────────────────────────────────────────────────────────────────
export const getSalesAssignments = () => http.get('/sales/shops')
export const getAssignments = () => http.get('/sales/assignments')
export const createAssignment = (data) => http.post('/sales/assignments', data)
export const endAssignment = (id, data) => http.patch(`/sales/assignments/${id}`, data)
export const updateAssignment = (id, data) => http.patch(`/sales/assignments/${id}`, data)
export const getIncentives = (params) => http.get('/sales/incentives', { params })
