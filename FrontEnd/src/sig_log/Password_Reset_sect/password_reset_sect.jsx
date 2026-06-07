import axios from 'axios'
import { useState } from 'react'
import classes from './password_reset_sect.module.scss'

export default function Password_reset_sect({ onBack }) {
    const [step, setStep] = useState('email')
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleRequestCode = async (event) => {
        event.preventDefault()
        setLoading(true)
        setMessage('')

        try {
            const response = await axios.post('http://localhost:3000/api/auth/password-reset/request', {
                email,
            })

            setMessage(response.data.message)
            setStep('code')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось отправить код')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async (event) => {
        event.preventDefault()
        setLoading(true)
        setMessage('')

        try {
            const response = await axios.post('http://localhost:3000/api/auth/password-reset/confirm', {
                email,
                code,
                password,
            })

            setMessage(response.data.message)
            setCode('')
            setPassword('')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось обновить пароль')
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className={classes.Reset}>
            <main>
                <div>
                    <div>
                        <button type="button" onClick={onBack}>Вход</button>
                        <button type="button">Восстановление</button>
                    </div>

                    {step === 'email' ? (
                        <form onSubmit={handleRequestCode}>
                            <h2>Восстановление пароля</h2>
                            <p className={classes.Description}>
                                Введите email, который указан в личном кабинете. На него придет код из 6 цифр.
                            </p>

                            <div>
                                <input
                                    type="email"
                                    placeholder="example@bar.by"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" disabled={loading}>
                                {loading ? 'Отправка...' : 'Получить код'}
                            </button>
                            <p>{message}</p>
                        </form>
                    ) : (
                        <form onSubmit={handleConfirm}>
                            <h2>Введите код</h2>
                            <p className={classes.Description}>
                                Код действует ограниченное время. После смены пароля войдите заново.
                            </p>

                            <div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength="6"
                                    placeholder="000000"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    required
                                />
                            </div>

                            <div>
                                <input
                                    type="password"
                                    placeholder="Новый пароль"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" disabled={loading}>
                                {loading ? 'Сохранение...' : 'Сменить пароль'}
                            </button>
                            <button
                                type="button"
                                className={classes.TextButton}
                                onClick={() => setStep('email')}
                            >
                                Отправить код заново
                            </button>
                            <p>{message}</p>
                        </form>
                    )}
                </div>
            </main>
        </section>
    )
}
