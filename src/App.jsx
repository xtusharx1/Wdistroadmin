import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getUser } from './auth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import ShopApprovals from './pages/admin/ShopApprovals'
import UserManagement from './pages/admin/UserManagement'
import Assignments from './pages/admin/Assignments'
import AdminOrders from './pages/admin/Orders'
import AdminInvoices from './pages/admin/Invoices'
import SellerDashboard from './pages/seller/Dashboard'
import Products from './pages/seller/Products'
import Inventory from './pages/seller/Inventory'
import SellerOrders from './pages/seller/Orders'
import SellerInvoices from './pages/seller/Invoices'
import AssignedShops from './pages/sales/AssignedShops'
import SalesOrders from './pages/sales/Orders'
import SalesDashboard from './pages/sales/Dashboard'
import AdminSalesPerformance from './pages/admin/SalesPerformance'
import SalesPerformance from './pages/sales/SalesPerformance'

function RoleRedirect() {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'Admin') return <Navigate to="/admin/dashboard" replace />
  if (user.role === 'Sales Executive') return <Navigate to="/sales/dashboard" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RoleRedirect />} />

        <Route element={<ProtectedRoute allowedRole="Admin" />}>
          <Route element={<Layout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/shops" element={<ShopApprovals />} />
            <Route path="/admin/shop-approvals" element={<Navigate to="/admin/shops" replace />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/assignments" element={<Assignments />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/inventory" element={<Inventory />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/invoices" element={<AdminInvoices />} />
            <Route path="/admin/sales-performance" element={<AdminSalesPerformance />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="Sales Executive" />}>
          <Route element={<Layout />}>
            <Route path="/sales/dashboard" element={<SalesDashboard />} />
            <Route path="/sales/shops" element={<AssignedShops />} />
            <Route path="/sales/orders" element={<SalesOrders />} />
            <Route path="/sales/performance" element={<SalesPerformance />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
