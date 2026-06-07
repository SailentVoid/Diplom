import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import Avatar_sect from './Avatar_sect/avatar_sect.jsx'
import Data_input_sect from './Data_input_sect/data_input_sect.jsx'
import classes from './user_lk.module.scss'

const profileFields = [
    {
        key: 'fullName',
        label: 'ФИО',
        type: 'text',
        placeholder: 'Ковалёв Артём Сергеевич',
        autoComplete: 'name',
    },
    {
        key: 'birthDate',
        label: 'Дата рождения',
        type: 'date',
        placeholder: '',
        autoComplete: 'bday',
    },
    {
        key: 'phone',
        label: 'Телефон',
        type: 'tel',
        placeholder: '+375 (29) 000-00-00',
        autoComplete: 'tel',
    },
    {
        key: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'example@bar.by',
        autoComplete: 'email',
    },
    {
        key: 'residentialAddress',
        label: 'Адрес проживания',
        type: 'text',
        placeholder: 'Брестская обл., г. Барановичи, ул. Советская, д. 10, кв. 5',
        autoComplete: 'street-address',
    },
    {
        key: 'registrationAddress',
        label: 'Адрес регистрации',
        type: 'text',
        placeholder: 'Брестская обл., г. Барановичи, ул. Ленина, д. 15',
        autoComplete: 'address-line1',
    },
]

const initialUserData = {
    fullName: 'Ковалёв Артём Сергеевич',
    birthDate: '2001-09-14',
    phone: '+375 (29) 123-45-67',
    email: 'kovalev@example.by',
    residentialAddress: 'Брестская обл., г. Барановичи, ул. Брестская, д. 12, кв. 8',
    registrationAddress: 'Брестская обл., г. Барановичи, ул. Советская, д. 18',
}

const initialFinancialData = {
    balance: 0,
    activeDebt: 0,
    currency: 'BYN',
}

const formatMoney = (value, currency = 'BYN') =>
    new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency,
    }).format(Number(value) || 0)

export default function PageLK() {
    const [userData, setUserData] = useState(initialUserData)
    const [formData, setFormData] = useState(initialUserData)
    const [financialData, setFinancialData] = useState(initialFinancialData)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentOrder, setPaymentOrder] = useState(null)
    const [paymentLoading, setPaymentLoading] = useState(false)
    const [paymentMessage, setPaymentMessage] = useState('')
    const [message, setMessage] = useState('')

    const loadProfile = useCallback(async () => {
        const token = localStorage.getItem('token')

        if (!token) {
            return
        }

        try {
            const response = await axios.get('http://localhost:3000/api/profile', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })

            const profile = {
                fullName: response.data.fullName || '',
                birthDate: response.data.birthDate ? response.data.birthDate.slice(0, 10) : '',
                phone: response.data.phone || '',
                email: response.data.email || '',
                residentialAddress: response.data.residentialAddress || '',
                registrationAddress: response.data.registrationAddress || '',
            }
            const finance = {
                balance: response.data.balance || 0,
                activeDebt: response.data.activeDebt || 0,
                currency: response.data.currency || 'BYN',
            }

            setUserData(profile)
            setFormData(profile)
            setFinancialData(finance)
            setPaymentAmount((currentAmount) => currentAmount || (finance.activeDebt > 0 ? String(finance.activeDebt) : ''))
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось загрузить данные профиля')
        }
    }, [])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        const token = localStorage.getItem('token')

        if (!token) {
            setMessage('Нужно войти в личный кабинет')
            return
        }

        try {
            setMessage('')
            await axios.put('http://localhost:3000/api/profile', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            setUserData({ ...formData })
            setMessage('Данные сохранены')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось сохранить данные профиля')
        }
    }

    const handleReset = () => {
        setFormData({ ...userData })
    }

    const handleCreateTelegramPayment = async () => {
        const token = localStorage.getItem('token')
        const amount = Number(paymentAmount)

        if (!token) {
            setPaymentMessage('Нужно войти в личный кабинет')
            return
        }

        if (!amount || amount <= 0) {
            setPaymentMessage('Укажи сумму оплаты больше 0')
            return
        }

        try {
            setPaymentLoading(true)
            setPaymentMessage('')

            const response = await axios.post(
                'http://localhost:3000/api/payments/telegram/orders',
                {
                    amount,
                    description: 'Оплата услуг филиала "Барановичиводоканал"',
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            setPaymentOrder(response.data.order)

            if (response.data.botUrl) {
                window.open(response.data.botUrl, '_blank', 'noopener,noreferrer')
            }

            setPaymentMessage(
                response.data.setupRequired
                    ? 'Платеж создан. Для реальной оплаты нужно указать токены Telegram-бота и платежного провайдера в .env backend.'
                    : 'Платеж создан. Открой Telegram-бота и подтверди оплату.'
            )
        } catch (error) {
            setPaymentMessage(error.response?.data?.error || 'Не удалось создать платеж Telegram')
        } finally {
            setPaymentLoading(false)
        }
    }

    useEffect(() => {
        if (!paymentOrder || paymentOrder.status === 'paid') {
            return undefined
        }

        const token = localStorage.getItem('token')

        if (!token) {
            return undefined
        }

        const timer = window.setInterval(async () => {
            try {
                const response = await axios.get(
                    `http://localhost:3000/api/payments/telegram/orders/${paymentOrder.id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                )

                setPaymentOrder(response.data.order)

                if (response.data.order.status === 'paid') {
                    setPaymentMessage('Оплата прошла успешно. Данные обновлены.')
                    await loadProfile()
                }
            } catch {
                window.clearInterval(timer)
            }
        }, 5000)

        return () => window.clearInterval(timer)
    }, [loadProfile, paymentOrder])

    const hasChanges = profileFields.some(({ key }) => formData[key] !== userData[key])

    return (
        <section className={classes.UserLK}>
            <div className={classes.Shell}>
                <div className={classes.Intro}>
                    <p className={classes.Eyebrow}>Личный кабинет</p>
                    <h1>Данные пользователя</h1>
                </div>

                <div className={classes.PanelGrid}>
                    <Avatar_sect userData={userData} profileFields={profileFields} />
                    <Data_input_sect
                        formData={formData}
                        profileFields={profileFields}
                        onChange={handleChange}
                        onSave={handleSave}
                        onReset={handleReset}
                        hasChanges={hasChanges}
                    />
                </div>

                <section className={classes.PaymentPanel}>
                    <div className={classes.PaymentHeader}>
                        <div>
                            <p className={classes.Eyebrow}>Оплата</p>
                            <h2>Платеж через Telegram-бота</h2>
                        </div>
                        {paymentOrder && (
                            <span className={classes.PaymentStatus}>
                                Статус: {paymentOrder.status}
                            </span>
                        )}
                    </div>

                    <div className={classes.FinanceGrid}>
                        <div className={classes.FinanceItem}>
                            <span>Баланс</span>
                            <strong>{formatMoney(financialData.balance, financialData.currency)}</strong>
                        </div>
                        <div className={classes.FinanceItem}>
                            <span>Активная задолженность</span>
                            <strong>{formatMoney(financialData.activeDebt, financialData.currency)}</strong>
                        </div>
                    </div>

                    <div className={classes.PaymentForm}>
                        <label>
                            <span>Сумма оплаты</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={paymentAmount}
                                onChange={(event) => setPaymentAmount(event.target.value)}
                                placeholder="0.00"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={handleCreateTelegramPayment}
                            disabled={paymentLoading}
                        >
                            {paymentLoading ? 'Создание платежа...' : 'Оплатить в Telegram'}
                        </button>
                    </div>

                    {paymentOrder?.telegramPayload && (
                        <p className={classes.PaymentHint}>
                            Заказ №{paymentOrder.id}. После подтверждения оплаты бот пришлет webhook,
                            а система обновит задолженность и баланс.
                            {paymentOrder.invoiceCurrency === 'XTR' &&
                                ` К оплате: ${paymentOrder.invoiceAmount} Telegram Stars.`}
                        </p>
                    )}
                    {paymentMessage && <p className={classes.PaymentMessage}>{paymentMessage}</p>}
                </section>
                {message && <p className={classes.Message}>{message}</p>}
            </div>
        </section>
    )
}
