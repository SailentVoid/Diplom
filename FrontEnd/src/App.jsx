import Header from '../src/header/header.jsx'
import Footer from '../src/footer/footer.jsx'
import Page1 from './home_page/index.jsx'
import PageLogSig from './sig_log/sign_login.jsx'
import PageLK from './user_page/user_lk.jsx'
import AdminPage from './admin_page/admin_page.jsx'
import { Route, Routes, BrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './protected_route/Protected_Route.jsx'
import { jwtDecode } from 'jwt-decode'

function isRootUser() {
  const token = localStorage.getItem('token')

  if (!token) {
    return false
  }

  try {
    const decoded = jwtDecode(token)

    return decoded.login === 'root'
  } catch {
    return false
  }
}

function AdminRoute() {
  return isRootUser() ? <AdminPage /> : <Navigate to="/Home_Page" replace />
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route index element={<PageLogSig />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/Home_Page" element={<Page1 />} />
            <Route path="/User_PageLK" element={<PageLK />} />
          </Route>
          <Route path="/Admin" element={<AdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </>
  )
}

export default App
