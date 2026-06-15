import { Navigate, Outlet } from 'react-router-dom'
import { getUser } from '../auth'

export default function ProtectedRoute({ allowedRole }) {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/" replace />
  return <Outlet />
}
