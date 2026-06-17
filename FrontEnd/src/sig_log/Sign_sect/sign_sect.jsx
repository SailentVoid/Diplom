import styleses from './sign_sect.module.scss'
import { useState } from 'react'
import axios from 'axios'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+375\(\d{2}\)\d{3}-\d{2}-\d{2}$/
const BIRTH_DATE_PATTERN = /^\d{2}\.\d{2}\.\d{4}$/

const isValidRuDate = (value) => {
    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)

    if (!match) {
        return false
    }

    const [, day, month, year] = match
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`)

    return (
        !Number.isNaN(date.getTime()) &&
        date.getUTCDate() === Number(day) &&
        date.getUTCMonth() + 1 === Number(month) &&
        date.getUTCFullYear() === Number(year)
    )
}

export default function Sign_sect({ onSwitch }) {
    const [fio, setFio] = useState('')
    const [password, setPassword] = useState('')
    const [login, setLogin] = useState('')
    const [street, setStreet] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [message, setMessage] = useState('')

    const validateForm = () => {
        if (!fio.trim()) return 'Ошибка в ФИО: поле обязательно для заполнения'
        if (!login.trim()) return 'Ошибка в логине: поле обязательно для заполнения'
        if (!street.trim()) return 'Ошибка в адресе: поле обязательно для заполнения'
        if (!phone.trim()) return 'Ошибка в телефоне: поле обязательно для заполнения'
        if (!PHONE_PATTERN.test(phone.trim())) {
            return 'Ошибка в телефоне: укажите номер по шаблону +375(11)222-33-44'
        }
        if (!email.trim()) return 'Ошибка в почте: поле обязательно для заполнения'
        if (!EMAIL_PATTERN.test(email.trim())) {
            return 'Ошибка в почте: укажите email по шаблону example1@Exammp.com'
        }
        if (!birthDate.trim()) return 'Ошибка с датой рождения: поле обязательно для заполнения'
        if (!BIRTH_DATE_PATTERN.test(birthDate.trim()) || !isValidRuDate(birthDate.trim())) {
            return 'Ошибка с датой рождения: укажите дату по шаблону 11.06.2007'
        }
        if (password.length < 6) return 'Ошибка в пароле: укажите пароль минимум из 6 символов'

        return ''
    }

    const handleSubmits = async (event) => {
        event.preventDefault()
        setMessage('')

        const validationError = validateForm()

        if (validationError) {
            setMessage(validationError)
            return
        }

        try {
            const response = await axios.post('http://localhost:3000/api/auth/register', {
                fio: fio.trim(),
                login: login.trim(),
                street: street.trim(),
                phone: phone.trim(),
                email: email.trim(),
                birthDate: birthDate.trim(),
                password,
            })

            setMessage(response.data.message)
            setFio('')
            setLogin('')
            setStreet('')
            setPhone('')
            setEmail('')
            setBirthDate('')
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

                    <form onSubmit={handleSubmits} noValidate>
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
                            <input
                                type="tel"
                                placeholder="+375(11)222-33-44"
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="example1@Exammp.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="11.06.2007"
                                value={birthDate}
                                onChange={(event) => setBirthDate(event.target.value)}
                                maxLength={10}
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
