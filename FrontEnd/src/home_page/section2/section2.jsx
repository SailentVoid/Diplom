import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import styleses from '../section2/section2.module.scss'

export default function Sect2() {
    const [hotWater, setHotWater] = useState(0)
    const [coldWater, setColdWater] = useState(0)
    const [currency, setCurrency] = useState('BYN')
    const [amountToPay, setAmountToPay] = useState(0)

    const loadBalances = useCallback(async () => {
        const token = localStorage.getItem('token')
        if (!token) return

        try {
            const response = await axios.get('http://localhost:3000/api/profile', {
                headers: { Authorization: `Bearer ${token}` },
            })
            setHotWater(response.data.hotWater || 0)
            setColdWater(response.data.coldWater || 0)
            setCurrency(response.data.currency || 'BYN')
            setAmountToPay(response.data.amountToPay || 0)
        } catch {
            // Silent fail for balance load
        }
    }, [])

    useEffect(() => {
        // Profile data is loaded after opening the home page.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadBalances()
    }, [loadBalances])

    const formatMoney = (value) =>
        new Intl.NumberFormat('ru-RU', { style: 'currency', currency }).format(Number(value) || 0)

    const formatReading = (value, unit) =>
        `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(Number(value) || 0)} ${unit}`

    return (
        <section className={styleses.Balance}>
            <div>
                <div className={styleses.Balance_container}>
                    <div className={styleses.BalanceInfo}>
                        <p>Горячая вода:</p>
                        <p>{formatReading(hotWater, 'м³')}</p>
                    </div>
                    <div className={styleses.BalanceInfo}>
                        <p>Холодная вода:</p>
                        <p>{formatReading(coldWater, 'м³')}</p>
                    </div>
                    <div className={styleses.BalanceInfo}>
                        <p>К оплате:</p>
                        <p>{formatMoney(amountToPay)}</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
