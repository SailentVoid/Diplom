import { Navigate, Outlet } from 'react-router-dom';

export function ProtectedRoute({ isAuth }) {
  if (!isAuth) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}