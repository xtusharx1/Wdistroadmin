import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getUser } from './auth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const StoreApprovals = lazy(() => import('./pages/admin/StoreApprovals'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const Assignments = lazy(() => import('./pages/admin/Assignments'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminInvoices = lazy(() => import('./pages/admin/Invoices'))
const SellerDashboard = lazy(() => import('./pages/seller/Dashboard'))
const Products = lazy(() => import('./pages/seller/Products'))
const FeaturedProducts = lazy(() => import('./pages/seller/FeaturedProducts'))
const VariationGroups = lazy(() => import('./pages/seller/VariationGroups'))
const Inventory = lazy(() => import('./pages/seller/Inventory'))
const SellerOrders = lazy(() => import('./pages/seller/Orders'))
const SellerInvoices = lazy(() => import('./pages/seller/Invoices'))
const AssignedStores = lazy(() => import('./pages/sales/AssignedStores'))
const SalesOrders = lazy(() => import('./pages/sales/Orders'))
const SalesDashboard = lazy(() => import('./pages/sales/Dashboard'))
const AdminSalesPerformance = lazy(() => import('./pages/admin/SalesPerformance'))
const SalesPerformance = lazy(() => import('./pages/sales/SalesPerformance'))
const PaymentSettlement = lazy(() => import('./pages/admin/PaymentSettlement'))

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
      <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleRedirect />} />

          <Route element={<ProtectedRoute allowedRole="Admin" />}>
            <Route element={<Layout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/stores" element={<StoreApprovals />} />
              <Route path="/admin/shops" element={<Navigate to="/admin/stores" replace />} />
              <Route path="/admin/shop-approvals" element={<Navigate to="/admin/stores" replace />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/assignments" element={<Assignments />} />
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/featured-products" element={<FeaturedProducts />} />
              <Route path="/admin/variation-groups" element={<VariationGroups />} />
              <Route path="/admin/inventory" element={<Inventory />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/invoices" element={<AdminInvoices />} />
              <Route path="/admin/payments" element={<PaymentSettlement />} />
              <Route path="/admin/sales-performance" element={<AdminSalesPerformance />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRole="Sales Executive" />}>
            <Route element={<Layout />}>
              <Route path="/sales/dashboard" element={<SalesDashboard />} />
              <Route path="/sales/stores" element={<AssignedStores />} />
              <Route path="/sales/shops" element={<Navigate to="/sales/stores" replace />} />
              <Route path="/sales/orders" element={<SalesOrders />} />
              <Route path="/sales/payments" element={<PaymentSettlement />} />
              <Route path="/sales/performance" element={<SalesPerformance />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
