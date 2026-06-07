import { Navigate, Outlet } from 'react-router-dom'

export function ProtectedRoute() {
  const isAuth = !!localStorage.getItem('token')

  if (!isAuth) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
