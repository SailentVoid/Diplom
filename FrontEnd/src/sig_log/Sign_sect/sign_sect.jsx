import styleses from './sign_sect.module.scss'
import { useState } from 'react'
import axios from 'axios'

export default function Sign_sect({ onSwitch }) {
    const [fio, setFio] = useState('')
    const [password, setPassword] = useState('')
    const [login, setLogin] = useState('')
    const [street, setStreet] = useState('')
    const [message, setMessage] = useState('')

    const handleSubmits = async (event) => {
        event.preventDefault()
        setMessage('')

        try {
            const response = await axios.post('http://localhost:3000/api/auth/register', {
                fio,
                password,
                login,
                street,
            })

            setMessage(response.data.message)
            setFio('')
            setLogin('')
            setStreet('')
            setPassword('')
            onSwitch()
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Ошибка регистрации'
            setMessage(errorMsg)
            console.log(error)
        }
    }

    return (
        <section className={styleses.Register}>
            <main>
                <div>
                    <div>
                        <button type="button" onClick={onSwitch}>Вход</button>
                        <button type="button">Регистрация</button>
                    </div>

                    <form onSubmit={handleSubmits}>
                        <h2>Регистрация абонента</h2>

                        <div>
                            <input
                                type="text"
                                placeholder="Иванов Иван Иванович"
                                value={fio}
                                onChange={(event) => setFio(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Придумайте логин"
                                value={login}
                                onChange={(event) => setLogin(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="ул. Примерная, д. 1, кв. 1"
                                value={street}
                                onChange={(event) => setStreet(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Минимум 6 символов"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                />
                                <button type="button">👁️</button>
                            </div>
                        </div>

                        <button type="submit">Зарегистрироваться</button>
                        <p>{message}</p>
                    </form>
                </div>
            </main>
        </section>
    )
}
