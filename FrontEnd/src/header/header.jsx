import classes from '../header/header.module.scss'
import axios from 'axios'
import { jwtDecode } from 'jwt-decode'
import logo from '../assets/icon.png' 
import {Link, useLocation} from 'react-router-dom'
import { useNavigate } from "react-router-dom"

export default function Header(){
    const navigate = useNavigate();
    useLocation();
    const token = localStorage.getItem('token')
    let isRootUser = false

    if (token) {
        try {
            const decoded = jwtDecode(token)
            isRootUser = decoded.login === 'root'
        } catch {
            isRootUser = false
        }
    }
    
    const handleLogout = () => {
            localStorage.removeItem('token');
            localStorage.removeItem('adminToken');
            delete axios.defaults.headers.common['Authorization'];
            navigate('/')
        };

    return(
        <>
        <header>
            <nav>
                <div>
                    <img src ={logo} ></img>
                    <div className={classes.LogoTextCont}>
                        <h1>Барановичиводоканал</h1>
                        <p>Филиал ГП "Брестводоканал"</p>
                    </div>
                </div>
                <div className={classes.LinkCont}>
                    <Link to={'/Home_Page'}>Главная</Link>
                    <Link to={'/User_PageLK'}>Личный кабинет</Link>
                    {isRootUser && <Link to={'/Admin'}>Админ</Link>}
                    <button type='exit' onClick={handleLogout} >Выход</button>
                </div>
            </nav>
        </header>
        </>
    )
}

