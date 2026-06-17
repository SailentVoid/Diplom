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
        type: 'text',
        placeholder: '11.06.2007',
        autoComplete: 'bday',
    },
    {
        key: 'phone',
        label: 'Телефон',
        type: 'tel',
        placeholder: '+375(11)222-33-44',
        autoComplete: 'tel',
    },
    {
        key: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'example1@Exammp.com',
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
    birthDate: '11.06.2007',
    phone: '+375(29)123-45-67',
    email: 'kovalev@example.by',
    residentialAddress: 'Брестская обл., г. Барановичи, ул. Брестская, д. 12, кв. 8',
    registrationAddress: 'Брестская обл., г. Барановичи, ул. Советская, д. 18',
}

const initialFinancialData = {
    hotWater: 0,
    coldWater: 0,
    hotWaterPreviousReading: 0,
    coldWaterPreviousReading: 0,
    hotWaterUnit: 'м3',
    coldWaterUnit: 'м3',
    hotWaterDebt: 0,
    coldWaterDebt: 0,
    amountToPay: 0,
    activeDebt: 0,
    currency: 'BYN',
}

const formatMoney = (value, currency = 'BYN') =>
    new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency,
    }).format(Number(value) || 0)

const formatReading = (value, unit = 'м3') =>
    `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(Number(value) || 0)} ${unit}`

const formatRuDate = (value) => {
    if (!value) return ''
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
    return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value)
}

const onlyDigits = (value) => String(value || '').replace(/\D/g, '')

const formatPhoneInput = (value) => {
    let digits = onlyDigits(value)

    if (digits.startsWith('375')) {
        digits = digits.slice(3)
    }

    digits = digits.slice(0, 9)

    const code = digits.slice(0, 2)
    const first = digits.slice(2, 5)
    const second = digits.slice(5, 7)
    const third = digits.slice(7, 9)

    let formatted = '+375'
    if (code) formatted += `(${code}`
    if (code.length === 2) formatted += ')'
    if (first) formatted += first
    if (second) formatted += `-${second}`
    if (third) formatted += `-${third}`

    return formatted
}

const formatRuDateInput = (value) => {
    const digits = onlyDigits(value).slice(0, 8)
    const day = digits.slice(0, 2)
    const month = digits.slice(2, 4)
    const year = digits.slice(4, 8)

    return [day, month, year].filter(Boolean).join('.')
}

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
                birthDate: formatRuDate(response.data.birthDate),
                phone: response.data.phone || '',
                email: response.data.email || '',
                residentialAddress: response.data.residentialAddress || '',
                registrationAddress: response.data.registrationAddress || '',
            }
            const finance = {
                hotWater: response.data.hotWater || 0,
                coldWater: response.data.coldWater || 0,
                hotWaterPreviousReading: response.data.hotWaterPreviousReading || response.data.hotWater || 0,
                coldWaterPreviousReading: response.data.coldWaterPreviousReading || response.data.coldWater || 0,
                hotWaterUnit: response.data.hotWaterUnit || 'м3',
                coldWaterUnit: response.data.coldWaterUnit || 'м3',
                hotWaterDebt: response.data.hotWaterDebt || 0,
                coldWaterDebt: response.data.coldWaterDebt || 0,
                amountToPay: response.data.amountToPay || 0,
                activeDebt: response.data.activeDebt || 0,
                currency: response.data.currency || 'BYN',
            }

            setUserData(profile)
            setFormData(profile)
            setFinancialData(finance)
            setPaymentAmount(finance.amountToPay > 0 ? String(finance.amountToPay) : '')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось загрузить данные профиля')
        }
    }, [])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    const handleChange = (field, value) => {
        let nextValue = value

        if (field === 'phone') {
            nextValue = formatPhoneInput(value)
        }

        if (field === 'birthDate') {
            nextValue = formatRuDateInput(value)
        }

        setFormData((prev) => ({ ...prev, [field]: nextValue }))
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

    const handleCreateFakePayment = async () => {
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
            setPaymentMessage('Откройте и подтвердите фиктивную оплату. Подтверждение займёт 2 секунды.')

            const response = await axios.post(
                'http://localhost:3000/api/payments/fake/quick-pay',
                {
                    amount,
                    description: 'Фиктивная оплата услуг водоснабжения',
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            setPaymentOrder(response.data.order)
            setPaymentMessage(response.data.message || 'Фиктивная оплата подтверждена. Задолженность обновлена.')
            localStorage.setItem('paymentsUpdatedAt', String(Date.now()))
            window.dispatchEvent(new Event('payments-updated'))
            await loadProfile()
        } catch (error) {
            setPaymentMessage(error.response?.data?.error || 'Не удалось выполнить фиктивную оплату')
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
                            <h2>Фиктивная оплата</h2>
                        </div>
                        {paymentOrder && (
                            <span className={classes.PaymentStatus}>
                                Статус: {paymentOrder.status}
                            </span>
                        )}
                    </div>

                    <div className={classes.FinanceGrid}>
                        <div className={classes.FinanceItem}>
                            <span>Горячая вода — последние показания</span>
                            <strong>{formatReading(financialData.hotWater, financialData.hotWaterUnit)}</strong>
                        </div>
                        <div className={classes.FinanceItem}>
                            <span>Холодная вода — последние показания</span>
                            <strong>{formatReading(financialData.coldWater, financialData.coldWaterUnit)}</strong>
                        </div>
                        <div className={classes.FinanceItem}>
                            <span>Долг за горячую воду</span>
                            <strong>{formatMoney(financialData.hotWaterDebt, financialData.currency)}</strong>
                        </div>
                        <div className={classes.FinanceItem}>
                            <span>Долг за холодную воду</span>
                            <strong>{formatMoney(financialData.coldWaterDebt, financialData.currency)}</strong>
                        </div>
                        <div className={`${classes.FinanceItem} ${financialData.amountToPay > 0 ? classes.DebtItem : ''}`}>
                            <span>К оплате сейчас</span>
                            <strong>{formatMoney(financialData.amountToPay, financialData.currency)}</strong>
                        </div>
                        <div className={classes.FinanceItem}>
                            <span>Активная задолженность в реестре</span>
                            <strong>{formatMoney(financialData.activeDebt, financialData.currency)}</strong>
                        </div>
                    </div>

                    {financialData.amountToPay > 0 && (
                        <p className={classes.PaymentHint}>
                            Система посчитала долг по последним начислениям: к оплате нужно
                            {' '}<strong>{formatMoney(financialData.amountToPay, financialData.currency)}</strong>.
                            Это сумма активных начислений по показаниям счётчиков и другим открытым долгам.
                        </p>
                    )}

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
                            onClick={handleCreateFakePayment}
                            disabled={paymentLoading}
                        >
                            {paymentLoading ? 'Подтверждение оплаты...' : 'Оплатить фиктивно'}
                        </button>
                    </div>

                    {paymentOrder?.id && (
                        <p className={classes.PaymentHint}>
                            Платёж №{paymentOrder.id} проведён как фиктивная оплата. История платежей и задолженность обновлены автоматически.
                        </p>
                    )}
                    {paymentMessage && <p className={classes.PaymentMessage}>{paymentMessage}</p>}
                </section>

                <section className={classes.PaymentPanel}>
                    <div className={classes.PaymentHeader}>
                        <div>
                            <p className={classes.Eyebrow}>Тестирование</p>
                            <h2>Расчет оплаты по показаниям счетчиков</h2>
                        </div>
                    </div>

                    <p style={{ marginBottom: '1rem', color: '#666' }}>
                        Введите только новые показания счётчиков. Старые показания автоматически берутся из базы. После расчёта новые показания сохраняются и при следующей оплате уже становятся старыми.
                    </p>

                    <FakePaymentSection
                        onPaymentComplete={loadProfile}
                        currency={financialData.currency}
                        financialData={financialData}
                    />
                </section>
                {message && <p className={classes.Message}>{message}</p>}
            </div>
        </section>
    )
}

function FakePaymentSection({ onPaymentComplete, currency, financialData }) {
    const [hotWaterReading, setHotWaterReading] = useState('')
    const [coldWaterReading, setColdWaterReading] = useState('')
    const [tariffs, setTariffs] = useState({})
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    const hotPrevious = Number(financialData?.hotWaterPreviousReading ?? financialData?.hotWater ?? 0)
    const coldPrevious = Number(financialData?.coldWaterPreviousReading ?? financialData?.coldWater ?? 0)

    useEffect(() => {
        const token = localStorage.getItem('token')

        if (!token) {
            return
        }

        axios
            .get('http://localhost:3000/api/tariffs', {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((response) => {
                const nextTariffs = {}
                ;(response.data.tariffs || []).forEach((tariff) => {
                    nextTariffs[tariff.water_type] = {
                        rate: Number(tariff.rate_per_unit) || 0,
                        unit: tariff.unit || 'м3',
                    }
                })
                setTariffs(nextTariffs)
            })
            .catch(() => {})
    }, [])

    const calculateLine = (newValue, previousValue, waterType) => {
        const reading = Number(newValue)

        if (!Number.isFinite(reading) || reading < previousValue) {
            return 0
        }

        const consumption = reading - previousValue

        if (waterType === 'hot_water') {
            const coldWaterPart = consumption * (tariffs.cold_water?.rate || 0)
            const heatingPart = consumption * (tariffs.hot_water?.rate || 0)

            return Math.round((coldWaterPart + heatingPart) * 100) / 100
        }

        const tariff = tariffs[waterType]?.rate || 0
        return Math.round(consumption * tariff * 100) / 100
    }

    const hotEstimated = calculateLine(hotWaterReading, hotPrevious, 'hot_water')
    const coldEstimated = calculateLine(coldWaterReading, coldPrevious, 'cold_water')
    const totalEstimated = Math.round((hotEstimated + coldEstimated) * 100) / 100

    const handleFakePayment = async () => {
        const token = localStorage.getItem('token')
        const hotReading = hotWaterReading === '' ? null : Number(hotWaterReading)
        const coldReading = coldWaterReading === '' ? null : Number(coldWaterReading)

        if (!token) {
            setMessage('Нужно войти в личный кабинет')
            return
        }

        if (hotReading === null && coldReading === null) {
            setMessage('Укажите новые показания хотя бы одного счетчика')
            return
        }

        if (hotReading !== null && hotReading < hotPrevious) {
            setMessage(`Горячая вода: новые показания не могут быть меньше старых (${hotPrevious})`)
            return
        }

        if (coldReading !== null && coldReading < coldPrevious) {
            setMessage(`Холодная вода: новые показания не могут быть меньше старых (${coldPrevious})`)
            return
        }

        try {
            setLoading(true)
            setMessage('')

            const response = await axios.post(
                'http://localhost:3000/api/payments/fake',
                {
                    hotWaterReading: hotReading,
                    coldWaterReading: coldReading,
                    description: 'Расчет оплаты по показаниям счетчика',
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            )

            setMessage(response.data.message || 'Показания сохранены. Эти значения станут старыми при следующем расчёте.')
            setHotWaterReading('')
            setColdWaterReading('')
            localStorage.setItem('paymentsUpdatedAt', String(Date.now()))
            window.dispatchEvent(new Event('payments-updated'))
            await onPaymentComplete()
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось сохранить показания счетчиков')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={classes.PaymentForm}>
            <label>
                <span>Горячая вода — старые показания из базы</span>
                <strong className={classes.ReadOnlyValue}>
                    {formatReading(hotPrevious, financialData?.hotWaterUnit || 'м3')}
                </strong>
            </label>
            <label>
                <span>Горячая вода — новые показания</span>
                <input
                    type="number"
                    min={hotPrevious}
                    step="0.001"
                    value={hotWaterReading}
                    onChange={(event) => setHotWaterReading(event.target.value)}
                    placeholder="Введите новые показания"
                />
            </label>
            <label>
                <span>Холодная вода — старые показания из базы</span>
                <strong className={classes.ReadOnlyValue}>
                    {formatReading(coldPrevious, financialData?.coldWaterUnit || 'м3')}
                </strong>
            </label>
            <label>
                <span>Холодная вода — новые показания</span>
                <input
                    type="number"
                    min={coldPrevious}
                    step="0.001"
                    value={coldWaterReading}
                    onChange={(event) => setColdWaterReading(event.target.value)}
                    placeholder="Введите новые показания"
                />
            </label>
            <p className={classes.PaymentHint}>
                Предварительное начисление к оплате: <strong>{formatMoney(totalEstimated, currency)}</strong>. Горячая вода считается как холодная вода по расходу + подогрев: расход м³ × тариф холодной воды + расход м³ × тариф Гкал
            </p>
            <button
                type="button"
                onClick={handleFakePayment}
                disabled={loading}
            >
                {loading ? 'Расчет...' : 'Сохранить показания и начислить оплату'}
            </button>
            {message && <p className={classes.PaymentMessage}>{message}</p>}
        </div>
    )
}
