import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import classes from './section3.module.scss'

const statusLabels = {
    created: 'Создан',
    invoice_sent: 'Инвойс отправлен',
    paid: 'Оплачен',
    failed: 'Ошибка',
    cancelled: 'Отменён',
    completed: 'Выполнен',
    pending: 'Ожидание',
}

const waterTypeLabels = {
    hot_water: 'Горячая вода',
    cold_water: 'Холодная вода',
}

const formatDate = (dateStr) => {
    if (!dateStr) return '—'

    const source = String(dateStr)
    const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/)

    if (match) {
        const [, year, month, day] = match
        return `${day}.${month}.${year}`
    }

    return source
}

export default function Sect3() {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)

    const loadHistory = useCallback(async () => {
        const token = localStorage.getItem('token')
        if (!token) {
            setLoading(false)
            return
        }

        try {
            const response = await axios.get('http://localhost:3000/api/payments/history', {
                headers: { Authorization: `Bearer ${token}` },
            })
            setHistory(response.data.history || [])
        } catch {
            // Silent fail
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadHistory()

        const reloadHistory = () => loadHistory()

        window.addEventListener('payments-updated', reloadHistory)
        window.addEventListener('focus', reloadHistory)
        window.addEventListener('storage', reloadHistory)

        return () => {
            window.removeEventListener('payments-updated', reloadHistory)
            window.removeEventListener('focus', reloadHistory)
            window.removeEventListener('storage', reloadHistory)
        }
    }, [loadHistory])

    const formatMoney = (value, curr = 'BYN') =>
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency: curr }).format(Number(value) || 0)

    return (
        <section className={classes.Payments}>
            <div>
                <h3>История платежей</h3>
                <div>
                    <table>
                        <thead>
                            <tr>
                                <td>Дата</td>
                                <td>Описание</td>
                                <td>Сумма</td>
                                <td>Статус</td>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td className="empty" colSpan="4">Загрузка...</td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td className="empty" colSpan="4">История платежей пуста</td>
                                </tr>
                            ) : (
                                history.map((item) => (
                                    <tr key={`${item.payment_type}-${item.id}`}>
                                        <td>{formatDate(item.created_at)}</td>
                                        <td>
                                            <div>
                                                {item.description || waterTypeLabels[item.water_type] || 'Оплата'}
                                                {item.consumption !== undefined && item.consumption !== null && (
                                                    <div style={{ fontSize: '0.85em', color: '#667085', marginTop: '0.25rem' }}>
                                                        {waterTypeLabels[item.water_type]}: {Number(item.previous_reading || 0).toLocaleString('ru-RU')} → {Number(item.current_reading || 0).toLocaleString('ru-RU')} {item.unit || ''}; расход {Number(item.consumption || 0).toLocaleString('ru-RU')} {item.unit || ''}; тариф {Number(item.tariff_rate || 0).toLocaleString('ru-RU')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>{formatMoney(item.amount, item.currency)}</td>
                                        <td>{statusLabels[item.status] || item.status}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}
