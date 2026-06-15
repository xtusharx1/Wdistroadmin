import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getUser, clearUser } from '../auth'

const NAV = {
  Admin: [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Shops', path: '/admin/shops' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Assignments', path: '/admin/assignments' },
    { label: 'Products', path: '/admin/products' },
    { label: 'Inventory', path: '/admin/inventory' },
    { label: 'Orders', path: '/admin/orders' },
    { label: 'Invoices', path: '/admin/invoices' },
    { label: 'Sales Tracking', path: '/admin/sales-performance' },
  ],
  'Sales Executive': [
    { label: 'Dashboard', path: '/sales/dashboard' },
    { label: 'Assigned Shops', path: '/sales/shops' },
    { label: 'Orders', path: '/sales/orders' },
    { label: 'My Performance', path: '/sales/performance' },
  ],
}

export default function Layout() {
  const user = getUser()
  const navigate = useNavigate()
  const links = NAV[user?.role] || []

  const handleLogout = () => {
    clearUser()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <p className="text-lg font-bold text-indigo-600">W Distro</p>
          <p className="text-xs text-gray-400 mt-0.5">{user?.role}</p>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
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

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
