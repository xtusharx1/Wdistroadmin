import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getUser, clearUser } from '../auth'

const NAV = {
  Admin: [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Stores', path: '/admin/stores' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Assignments', path: '/admin/assignments' },
    { label: 'Products', path: '/admin/products' },
    { label: 'Featured Products', path: '/admin/featured-products' },
    { label: 'Variation Groups', path: '/admin/variation-groups' },
    { label: 'Inventory', path: '/admin/inventory' },
    { label: 'Inventory Receiving', path: '/admin/inventory-receiving' },
    { label: 'Orders', path: '/admin/orders' },
    { label: 'Invoices', path: '/admin/invoices' },
    { label: 'Payments', path: '/admin/payments' },
    { label: 'Sales Tracking', path: '/admin/sales-performance' },
  ],
  'Sales Executive': [
    { label: 'Dashboard', path: '/sales/dashboard' },
    { label: 'Assigned Stores', path: '/sales/stores' },
    { label: 'Orders', path: '/sales/orders' },
    { label: 'Payments', path: '/sales/payments' },
    { label: 'My Performance', path: '/sales/performance' },
  ],
}

export default function Layout() {
  const user = getUser()
  const navigate = useNavigate()
  const links = NAV[user?.role] || []
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    clearUser()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:shrink-0
        `}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-indigo-600">W Distro</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.role}</p>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-gray-400 hover:text-gray-600 text-xl leading-none w-6 h-6 flex items-center justify-center"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
          <p className="text-xs text-gray-400 truncate mb-3">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700 p-1 -ml-1 rounded"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-indigo-600">W Distro</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
