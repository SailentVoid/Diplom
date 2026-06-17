import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import classes from './admin_page.module.scss'

const apiUrl = 'http://localhost:3000/api/admin'

const columnLabels = {
    id: 'ID',
    fio: 'ФИО',
    login: 'Логин',
    street: 'Адрес',
    registration_id: 'ID пользователя (служебно)',
    user_fio: 'ФИО пользователя',
    full_name: 'ФИО',
    birth_date: 'Дата рождения',
    phone: 'Телефон',
    email: 'Email',
    residential_address: 'Адрес проживания',
    registration_address: 'Адрес регистрации',
    role: 'Роль',
    is_active: 'Активен',
    hot_water: 'Горячая вода / показания',
    cold_water: 'Холодная вода / показания',
    active_debt: 'Активный долг',
    hot_water_debt: 'Долг горячей воды',
    cold_water_debt: 'Долг холодной воды',
    amount_to_pay: 'К оплате',
    debtor_status: 'Статус долга',
    water_type: 'Тип воды',
    water_type_label: 'Тип воды',
    amount: 'Сумма к оплате',
    currency: 'Валюта',
    debt_amount: 'Сумма долга',
    reason: 'Причина',
    status: 'Статус',
    previous_reading: 'Старые показания',
    current_reading: 'Текущие/новые показания',
    consumption: 'Расход',
    tariff_rate: 'Тариф',
    rate_per_unit: 'Тариф за ед.',
    unit: 'Ед. измерения',
    effective_from: 'Действует с',
    telegram_payload: 'Payload Telegram',
    telegram_chat_id: 'Chat ID',
    telegram_username: 'Telegram',
    description: 'Описание',
    telegram_payment_charge_id: 'ID платежа Telegram',
    provider_payment_charge_id: 'ID платежного провайдера',
    password: 'Пароль',
    invoice_sent_at: 'Инвойс отправлен',
    paid_at: 'Оплачено',
    closed_at: 'Дата закрытия',
    created_at: 'Создано',
    updated_at: 'Обновлено',
}

const actionLabels = {
    user_register: 'Регистрация пользователя',
    profile_update: 'Пользователь изменил профиль',
    admin_create: 'Администратор добавил запись',
    admin_update: 'Администратор изменил запись',
    admin_delete: 'Администратор удалил запись',
    password_reset_code_requested: 'Пользователь запросил код восстановления',
    password_reset_completed: 'Пользователь сменил пароль',
    telegram_payment_created: 'Пользователь создал платеж Telegram',
    telegram_payment_paid: 'Платеж Telegram оплачен',
    fake_payment_created: 'Пользователь создал тестовый платеж',
    fake_payment_paid: 'Фиктивная оплата подтверждена',
    meter_reading_payment_created: 'Расчет оплаты по показаниям счетчика',
    balance_auto_debtor_created: 'Пользователь помечен должником',
    balance_auto_debtor_updated: 'Сумма автоматического долга обновлена',
    balance_auto_debtor_closed: 'Автоматический долг закрыт',
}

const dateOnlyColumns = new Set(['birth_date', 'effective_from', 'closed_at'])
const dateTimeColumns = new Set(['created_at', 'updated_at', 'invoice_sent_at', 'paid_at'])

const isDateLikeString = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value)

const formatDateValue = (value, withTime = false) => {
    if (!value) {
        return '—'
    }

    const source = value instanceof Date ? value.toISOString() : String(value)
    const match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/)

    if (!match) {
        return String(value)
    }

    const [, year, month, day, hour, minute, second] = match
    const date = `${day}.${month}.${year}`

    if (!withTime || !hour) {
        return date
    }

    return `${date}, ${hour}:${minute}:${second}`
}


const toInputDate = (value) => {
    if (!value) return ''
    const source = String(value)
    const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`
    return source
}

const waterTypeLabels = {
    hot_water: 'Горячая вода',
    cold_water: 'Холодная вода',
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

const getInputProps = (column) => {
    if (column === 'phone') {
        return { type: 'tel', placeholder: '+375(11)222-33-44', pattern: '^\\+375\\(\\d{2}\\)\\d{3}-\\d{2}-\\d{2}$', inputMode: 'numeric' }
    }

    if (column === 'email') {
        return { type: 'email', placeholder: 'example1@Exammp.com' }
    }

    if (column === 'birth_date') {
        return { type: 'text', placeholder: '11.06.2007', pattern: '^\\d{2}\\.\\d{2}\\.\\d{4}$', inputMode: 'numeric', maxLength: 10 }
    }

    if (dateOnlyColumns.has(column)) {
        return { type: 'text', placeholder: '11.06.2007' }
    }

    if (column === 'password') {
        return { type: 'password', placeholder: 'Пароль для входа пользователя' }
    }

    return { type: 'text' }
}

const normalizeFormValue = (column, value) => {
    if (column === 'birth_date' || dateOnlyColumns.has(column)) {
        return toInputDate(value)
    }

    return value ?? ''
}

const formatCellValue = (value, column = '') => {
    if (value === null || value === undefined || value === '') {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Да' : 'Нет'
    }

    if (column === 'water_type') {
        return waterTypeLabels[value] || String(value)
    }

    if (dateOnlyColumns.has(column)) {
        return formatDateValue(value, false)
    }

    if (dateTimeColumns.has(column)) {
        return formatDateValue(value, true)
    }

    if (isDateLikeString(value)) {
        return formatDateValue(value, false)
    }

    return String(value)
}

const isDebtorRow = (tableName, row) =>
    ['registration_data', 'water_balances'].includes(tableName) &&
    (row.debtor_status === 'Должник' || Number(row.amount) < 0 || Number(row.hot_water) < 0 || Number(row.cold_water) < 0)

const isNegativeMoneyColumn = (column, value) =>
    ['amount', 'hot_water', 'cold_water'].includes(column) && Number(value) < 0

const isDebtMoneyColumn = (column, value) =>
    ['hot_water_debt', 'cold_water_debt', 'amount_to_pay'].includes(column) && Number(value) > 0

const renderTableCell = (tableName, row, column) => {
    const value = row[column]

    if (column === 'debtor_status') {
        return (
            <span className={isDebtorRow(tableName, row) ? classes.DebtorBadge : classes.StatusBadge}>
                {formatCellValue(value)}
            </span>
        )
    }

    if (isNegativeMoneyColumn(column, value) || isDebtMoneyColumn(column, value)) {
        return <strong className={classes.NegativeAmount}>{formatCellValue(value, column)}</strong>
    }

    return formatCellValue(value, column)
}

const formatDateTime = (value) => formatDateValue(value, true)

const humanizeLogObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return formatLogValue(value)
    }

    return Object.entries(value)
        .map(([key, nextValue]) => `${columnLabels[key] || key}: ${formatLogValue(nextValue)}`)
        .join('; ')
}

const formatLogValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return 'пусто'
    }

    if (typeof value === 'boolean') {
        return value ? 'Да' : 'Нет'
    }

    if (value === 'hot_water' || value === 'cold_water') {
        return waterTypeLabels[value] || String(value)
    }

    if (isDateLikeString(value)) {
        return formatDateValue(value, value.includes('T') || value.includes(' '))
    }

    if (Array.isArray(value)) {
        return value.map(humanizeLogObject).join('; ')
    }

    if (typeof value === 'object') {
        return humanizeLogObject(value)
    }

    return String(value)
}

const renderSnapshotChanges = (changes) => {
    const rows = []

    if (changes.before) {
        rows.push(['До изменения', changes.before])
    }

    if (changes.after) {
        rows.push(['После изменения', changes.after])
    }

    return (
        <div className={classes.ChangeList}>
            {rows.map(([label, value]) => (
                <div key={label} className={classes.ChangeItem}>
                    <span>{label}</span>
                    <p>{formatLogValue(value)}</p>
                </div>
            ))}
        </div>
    )
}

const renderLogChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) {
        return <p className={classes.LogMuted}>Изменений в полях не найдено</p>
    }

    if (changes.before || changes.after) {
        return renderSnapshotChanges(changes)
    }

    return (
        <div className={classes.ChangeList}>
            {Object.entries(changes).map(([field, change]) => (
                <div key={field} className={classes.ChangeItem}>
                    <span>{columnLabels[field] || field}</span>
                    <p>
                        {formatLogValue(change.from)} → {formatLogValue(change.to)}
                    </p>
                </div>
            ))}
        </div>
    )
}

export default function AdminPage() {
    const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '')
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')
    const [tables, setTables] = useState([])
    const [activeTable, setActiveTable] = useState('')
    const [activeMeta, setActiveMeta] = useState(null)
    const [rows, setRows] = useState([])
    const [formMode, setFormMode] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [formData, setFormData] = useState({})
    const [loading, setLoading] = useState(false)
    const [logs, setLogs] = useState([])
    const [userOptions, setUserOptions] = useState([])

    const authHeaders = useMemo(
        () => ({
            Authorization: `Bearer ${adminToken}`,
        }),
        [adminToken]
    )

    const loadRows = useCallback(async (tableName) => {
        setLoading(true)
        setMessage('')

        try {
            const response = await axios.get(`${apiUrl}/tables/${tableName}`, {
                headers: authHeaders,
            })

            setActiveTable(tableName)
            setActiveMeta(response.data.table)
            setRows(response.data.rows)
            setFormMode('')
            setSelectedId(null)
            setFormData({})
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось загрузить таблицу')
        } finally {
            setLoading(false)
        }
    }, [authHeaders])

    const loadLogs = useCallback(async () => {
        setLoading(true)
        setMessage('')

        try {
            const response = await axios.get(`${apiUrl}/logs`, {
                headers: authHeaders,
            })

            setActiveTable('audit_logs')
            setActiveMeta(null)
            setRows([])
            setFormMode('')
            setSelectedId(null)
            setFormData({})
            setLogs(response.data.logs)
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось загрузить журнал действий')
        } finally {
            setLoading(false)
        }
    }, [authHeaders])

    const loadTables = useCallback(async () => {
        setLoading(true)
        setMessage('')

        try {
            const response = await axios.get(`${apiUrl}/tables`, {
                headers: authHeaders,
            })

            const nextTables = response.data.tables
            setTables(nextTables)

            if (nextTables.length > 0) {
                await loadRows(nextTables[0].name)
            }
        } catch (error) {
            localStorage.removeItem('adminToken')
            setAdminToken('')
            setMessage(error.response?.data?.error || 'Войдите как администратор')
        } finally {
            setLoading(false)
        }
    }, [authHeaders, loadRows])

    const loadUserOptions = useCallback(async () => {
        if (!adminToken) {
            setUserOptions([])
            return
        }

        try {
            const response = await axios.get(`${apiUrl}/tables/registration_data`, {
                headers: authHeaders,
            })

            setUserOptions(response.data.rows || [])
        } catch {
            setUserOptions([])
        }
    }, [adminToken, authHeaders])

    useEffect(() => {
        if (adminToken) {
            loadTables()
            loadUserOptions()
        }
    }, [adminToken, loadTables, loadUserOptions])

    useEffect(() => {
        if (!adminToken) {
            return undefined
        }

        const events = new EventSource(`${apiUrl}/logs/stream?token=${encodeURIComponent(adminToken)}`)

        events.addEventListener('audit-log', (event) => {
            const nextLog = JSON.parse(event.data)

            setLogs((prev) => [
                nextLog,
                ...prev.filter((log) => log.id !== nextLog.id),
            ].slice(0, 100))
        })

        return () => {
            events.close()
        }
    }, [adminToken])

    const handleLogin = async (event) => {
        event.preventDefault()
        setMessage('')

        try {
            const response = await axios.post(`${apiUrl}/login`, {
                login,
                password,
            })

            localStorage.setItem('adminToken', response.data.token)
            setAdminToken(response.data.token)
            setLogin('')
            setPassword('')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Ошибка входа в админ-панель')
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('adminToken')
        setAdminToken('')
        setTables([])
        setRows([])
        setActiveTable('')
        setActiveMeta(null)
        setFormMode('')
        setMessage('')
    }

    const startCreate = () => {
        const nextData = activeMeta.createable.reduce((acc, column) => {
            acc[column] = ''
            return acc
        }, {})

        setFormMode('create')
        setSelectedId(null)
        setFormData(nextData)
    }

    const startEdit = (row) => {
        const nextData = activeMeta.editable.reduce((acc, column) => {
            acc[column] = normalizeFormValue(column, row[column])
            return acc
        }, {})

        setFormMode('edit')
        setSelectedId(row.id)
        setFormData(nextData)
    }

    const handleFieldChange = (column, value) => {
        let nextValue = value

        if (column === 'phone') {
            nextValue = formatPhoneInput(value)
        }

        if (column === 'birth_date') {
            nextValue = formatRuDateInput(value)
        }

        setFormData((prev) => ({
            ...prev,
            [column]: nextValue,
        }))
    }

    const handleSave = async (event) => {
        event.preventDefault()
        setMessage('')

        try {
            if (formMode === 'create') {
                await axios.post(`${apiUrl}/tables/${activeTable}`, formData, {
                    headers: authHeaders,
                })
            } else {
                await axios.put(`${apiUrl}/tables/${activeTable}/${selectedId}`, formData, {
                    headers: authHeaders,
                })
            }

            await loadRows(activeTable)
            setMessage('Изменения сохранены')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось сохранить запись')
        }
    }

    const handleDelete = async (row) => {
        const accepted = window.confirm(`Удалить запись #${row.id} из таблицы ${activeMeta.title}?`)

        if (!accepted) {
            return
        }

        try {
            await axios.delete(`${apiUrl}/tables/${activeTable}/${row.id}`, {
                headers: authHeaders,
            })
            await loadRows(activeTable)
            setMessage('Запись удалена')
        } catch (error) {
            setMessage(error.response?.data?.error || 'Не удалось удалить запись')
        }
    }

    if (!adminToken) {
        return (
            <section className={`${classes.AdminPage} ${classes.AdminLoginPage}`}>
                <div className={classes.Shell}>
                    <div className={classes.Intro}>
                        <p className={classes.Eyebrow}>Администрирование</p>
                        <h1>Панель управления базой данных</h1>
                    </div>

                    <form className={classes.LoginPanel} onSubmit={handleLogin}>
                        <h2>Вход администратора</h2>
                        <input
                            type="text"
                            placeholder="Логин администратора"
                            value={login}
                            onChange={(event) => setLogin(event.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Пароль администратора"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                        <button type="submit">Войти</button>
                        {message && <p className={classes.Message}>{message}</p>}
                    </form>
                </div>
            </section>
        )
    }

    return (
        <section className={classes.AdminPage}>
            <div className={classes.Shell}>
                <div className={classes.Intro}>
                    <div>
                        <p className={classes.Eyebrow}>Администрирование</p>
                        <h1>Панель управления базой данных</h1>
                    </div>
                    <button type="button" onClick={handleLogout}>
                        Выйти
                    </button>
                </div>

                <div className={classes.Workspace}>
                    <aside className={classes.Sidebar}>
                        {tables.map((table) => (
                            <button
                                key={table.name}
                                type="button"
                                className={table.name === activeTable ? classes.ActiveTable : ''}
                                onClick={() => loadRows(table.name)}
                            >
                                {table.title}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={activeTable === 'audit_logs' ? classes.ActiveTable : ''}
                            onClick={loadLogs}
                        >
                            Журнал действий
                        </button>
                    </aside>

                    <div className={classes.Content}>
                        {activeTable === 'audit_logs' ? (
                            <>
                                <div className={classes.Toolbar}>
                                    <div>
                                        <h2>Журнал действий</h2>
                                        <p>
                                            {loading
                                                ? 'Загрузка событий...'
                                                : `Событий: ${logs.length}. Новые записи появляются автоматически`}
                                        </p>
                                    </div>

                                    <button type="button" onClick={loadLogs}>
                                        Обновить
                                    </button>
                                </div>

                                <div className={classes.LogList}>
                                    {logs.map((log) => (
                                        <article key={log.id} className={classes.LogCard}>
                                            <div className={classes.LogHeader}>
                                                <div>
                                                    <h3>{actionLabels[log.action] || log.action}</h3>
                                                    <p>
                                                        {log.actor_login || 'неизвестно'} · {log.entity_table}
                                                        {log.entity_id ? ` #${log.entity_id}` : ''}
                                                    </p>
                                                </div>
                                                <time>{formatDateTime(log.created_at)}</time>
                                            </div>
                                            {renderLogChanges(log.changes)}
                                        </article>
                                    ))}

                                    {!loading && logs.length === 0 && (
                                        <p className={classes.EmptyText}>Журнал действий пока пуст</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={classes.Toolbar}>
                                    <div>
                                        <h2>{activeMeta?.title || 'Таблица'}</h2>
                                        <p>{loading ? 'Загрузка данных...' : `Записей: ${rows.length}`}</p>
                                    </div>

                                    {activeMeta?.createable?.length > 0 && (
                                        <button type="button" onClick={startCreate}>
                                            Добавить запись
                                        </button>
                                    )}
                                </div>

                                <div className={classes.TableWrap}>
                                    <table>
                                        <thead>
                                            <tr>
                                                {activeMeta?.columns.map((column) => (
                                                    <th key={column}>{columnLabels[column] || column}</th>
                                                ))}
                                                <th>Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className={isDebtorRow(activeTable, row) ? classes.DebtorRow : ''}
                                                >
                                                    {activeMeta.columns.map((column) => (
                                                        <td key={column}>{renderTableCell(activeTable, row, column)}</td>
                                                    ))}
                                                    <td>
                                                        <div className={classes.ActionRow}>
                                                            {activeMeta.editable.length > 0 && (
                                                                <button type="button" onClick={() => startEdit(row)}>
                                                                    Изменить
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={() => handleDelete(row)}>
                                                                Удалить
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {!loading && rows.length === 0 && (
                                        <p className={classes.EmptyText}>В этой таблице пока нет записей</p>
                                    )}
                                </div>

                                {formMode && (
                                    <form className={classes.EditorPanel} onSubmit={handleSave}>
                                        <div className={classes.EditorHeader}>
                                            <h3>
                                                {formMode === 'create'
                                                    ? 'Добавление записи'
                                                    : `Редактирование записи #${selectedId}`}
                                            </h3>
                                            <button type="button" onClick={() => setFormMode('')}>
                                                Закрыть
                                            </button>
                                        </div>

                                        <div className={classes.FieldGrid}>
                                            {Object.keys(formData).map((column) => (
                                                <label key={column} className={classes.Field}>
                                                    <span>{columnLabels[column] || column}</span>
                                                    {column === 'water_type' ? (
                                                        <select
                                                            value={String(formData[column] ?? '')}
                                                            onChange={(event) =>
                                                                handleFieldChange(column, event.target.value)
                                                            }
                                                            required
                                                        >
                                                            <option value="">Выберите тип воды</option>
                                                            <option value="hot_water">Горячая вода</option>
                                                            <option value="cold_water">Холодная вода</option>
                                                        </select>
                                                    ) : column === 'registration_id' ? (
                                                        <select
                                                            value={String(formData[column] ?? '')}
                                                            onChange={(event) =>
                                                                handleFieldChange(column, event.target.value)
                                                            }
                                                            required
                                                        >
                                                            <option value="">Выберите пользователя</option>
                                                            {userOptions.map((user) => (
                                                                <option key={user.id} value={user.id}>
                                                                    {user.fio} ({user.login})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : column === 'is_active' ? (
                                                        <select
                                                            value={String(formData[column] ?? '')}
                                                            onChange={(event) =>
                                                                handleFieldChange(column, event.target.value)
                                                            }
                                                        >
                                                            <option value="true">Да</option>
                                                            <option value="false">Нет</option>
                                                        </select>
                                                    ) : (
                                                        <input
                                                            {...getInputProps(column)}
                                                            value={String(formData[column] ?? '')}
                                                            onChange={(event) =>
                                                                handleFieldChange(column, event.target.value)
                                                            }
                                                            required
                                                        />
                                                    )}
                                                </label>
                                            ))}
                                        </div>

                                        <button type="submit" className={classes.SaveButton}>
                                            Сохранить
                                        </button>
                                    </form>
                                )}
                            </>
                        )}

                        {message && <p className={classes.Message}>{message}</p>}
                    </div>
                </div>
            </div>
        </section>
    )
}
