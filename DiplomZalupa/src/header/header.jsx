import classes from '../header/header.module.scss'
import axios from 'axios'
import { useState,useEffect } from 'react'
import logo from '../assets/icon.png' 
import {Link} from 'react-router-dom'
import { useNavigate } from "react-router-dom"

export default function Header(){
    const navigate = useNavigate();
    const [login, setLogin] = useState('');    
    const [message, setMessage] = useState('');  
    const [data, setData] = useState([])
    const [token, setToken] = useState(localStorage.getItem('token'))
    
    const handleLogout = () => {
            setLogin(null);
            setToken(null);
            setData([]);
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setMessage('Выход выполнен');
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
                    <button type='exit' onClick={handleLogout} >Выход</button>
                </div>
            </nav>
        </header>
        </>
    )
}

