import Header from '../src/header/header.jsx'
import Footer from '../src/footer/footer.jsx'
import Page1 from './home_page/index.jsx'
import PageLogSig from './sig_log/sign_login.jsx'
import PageLK from './user_page/user_lk.jsx'
import { Route,Routes,BrowserRouter, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { ProtectedRoute } from './protected_route/Protected_Route.jsx'
import Log_sect from './sig_log/Log_sect/log_sect.jsx'
function App() {
  const [token, setToken]= useState(localStorage.getItem('token'))
  const isAuth = !!token
  return (
    <>
      <BrowserRouter>
       <Header/>
       <Routes>
          <Route index element = {<PageLogSig/>}/>
            <Route element = {<ProtectedRoute isAuth={isAuth}/>}> 
              <Route path='/Home_Page' element = {<Page1/>}/>
              <Route path='/User_PageLK' element = {<PageLK/>}/> 
            </Route>
            <Route path='*' element = {<Navigate to = '/' replace/>}/>
        </Routes>
        <Footer/>
      </BrowserRouter>
    </>
  )
}

export default App
