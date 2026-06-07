import classes from './log_sect.module.scss'
import axios from 'axios'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Log_sect({ onSwitch, onResetPassword }) {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [login, setLogin] = useState('')
    const [message, setMessage] = useState('')

    const handleLogin = async (event) => {
        event.preventDefault()
        setMessage('')

        try {
            const response = await axios.post('http://localhost:3000/api/auth/login', {
                login,
                password,
            })

            localStorage.setItem('token', response.data.token)
            setMessage('Вход выполнен успешно')
            setLogin('')
            setPassword('')
            navigate('/Home_Page')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка входа')
            console.log(error)
        }
    }

    return (
        <section className={classes.Login}>
            <main>
                <div>
                    <div>
                        <button type="button">Вход</button>
                        <button type="button" onClick={onSwitch}>Регистрация</button>
                    </div>

                    <form onSubmit={handleLogin}>
                        <h2>Вход в личный кабинет</h2>

                        <div>
                            <input
                                type="text"
                                placeholder="Введите имя пользователя"
                                value={login}
                                onChange={(event) => setLogin(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Введите пароль"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                />
                                <button type="button">👁️</button>
                            </div>
                        </div>

                        <button type="submit">Войти</button>
                        <button
                            type="button"
                            className={classes.TextButton}
                            onClick={onResetPassword}
                        >
                            Забыли пароль?
                        </button>
                        <p>{message}</p>
                    </form>
                </div>
            </main>
        </section>
    )
}
