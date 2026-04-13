import classes from "./log_sect.module.scss"
import axios from 'axios'
import { useState,useEffect } from 'react'
import { useNavigate } from "react-router-dom"
export default function Log_sect({onSwitch}) {
     const navigate = useNavigate();
        const [password, setPassword] = useState('');
        const [login, setLogin] = useState('');    
        const [message, setMessage] = useState('');  
        const [data, setData] = useState([])
        const [token, setToken] = useState(localStorage.getItem('token'))

        useEffect(() => {
        axios.interceptors.request.use((config) => {
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
                config.headers.Authorization = `Bearer ${currentToken}`;
            }
            return config;
        });
         }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setMessage('');
      
        try {
            const response = await axios.post('http://localhost:3000/api/auth/login', {
                login: login,
                password: password,
            });
            
            const newToken = response.data.token;
            setToken(newToken);
            setLogin(response.data.login);
            localStorage.setItem('token', newToken);

            setMessage('✅ Вход успешен!');

            setLogin('');
            setPassword('');
            navigate('/Home_page')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка входа');
            console.log(error)
        } 
    };

    

    return (
        <section className={classes.Login}>
            <main>
                <div>
                    <div>
                        <button>Вход</button>
                        <button type = "button" onClick = {onSwitch}>Регистрация</button>
                    </div>

                    <form onSubmit={handleLogin}>
                        <h2>Вход в личный кабинет</h2>
                        
                        <div>
                            <input
                                type="text"
                                placeholder="Введите имя пользователя"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                required
                            />
                        </div>
                        
                        <div>
                            <div>
                                <input
                                    type="current-password"
                                    placeholder="Введите пароль"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button type="button">👁️</button>
                            </div>
                        </div>
                        
                        <button type="submit" onClick={handleLogin}>Войти</button>
                        <p></p>
                    </form>
                </div>
            </main>
        </section>
    )
}
