import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import classes from './admin_page.module.scss'

const apiUrl = 'http://localhost:3000/api/admin'

const columnLabels = {
    id: 'ID',
    fio: 'ФИО',
    login: 'Логин',
    street: 'Адрес',
    registration_id: 'ID пользователя',
    full_name: 'ФИО',
    birth_date: 'Дата рождения',
    phone: 'Телефон',
    email: 'Email',
    residential_address: 'Адрес проживания',
    registration_address: 'Адрес регистрации',
    role: 'Роль',
    is_active: 'Активен',
    balance: 'Баланс',
    active_debt: 'Активный долг',
    debtor_status: 'Статус долга',
    amount: 'Баланс',
    currency: 'Валюта',
    debt_amount: 'Сумма долга',
    reason: 'Причина',
    status: 'Статус',
    telegram_payload: 'Payload Telegram',
    telegram_chat_id: 'Chat ID',
    telegram_username: 'Telegram',
    description: 'Описание',
    telegram_payment_charge_id: 'ID платежа Telegram',
    provider_payment_charge_id: 'ID платежного провайдера',
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
    balance_auto_debtor_created: 'Пользователь помечен должником',
    balance_auto_debtor_updated: 'Сумма автоматического долга обновлена',
    balance_auto_debtor_closed: 'Автоматический долг закрыт',
}

const formatCellValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return '—'
    }

    if (typeof value === 'boolean') {
        return value ? 'Да' : 'Нет'
    }

    return String(value)
}

const isDebtorRow = (tableName, row) =>
    ['registration_data', 'balances'].includes(tableName) &&
    (row.debtor_status === 'Должник' || Number(row.amount) < 0 || Number(row.balance) < 0)

const isNegativeMoneyColumn = (column, value) =>
    ['amount', 'balance'].includes(column) && Number(value) < 0

const renderTableCell = (tableName, row, column) => {
    const value = row[column]

    if (column === 'debtor_status') {
        return (
            <span className={isDebtorRow(tableName, row) ? classes.DebtorBadge : classes.StatusBadge}>
                {formatCellValue(value)}
            </span>
        )
    }

    if (isNegativeMoneyColumn(column, value)) {
        return <strong className={classes.NegativeAmount}>{formatCellValue(value)}</strong>
    }

    return formatCellValue(value)
}

const formatDateTime = (value) => {
    if (!value) {
        return '—'
    }

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'medium',
    }).format(new Date(value))
}

const formatLogValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return 'пусто'
    }

    if (typeof value === 'object') {
        return JSON.stringify(value)
    }

    return String(value)
}

const renderLogChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) {
        return <p className={classes.LogMuted}>Изменений в полях не найдено</p>
    }

    if (changes.before || changes.after) {
        return <pre className={classes.LogJson}>{JSON.stringify(changes, null, 2)}</pre>
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

    useEffect(() => {
        if (adminToken) {
            loadTables()
        }
    }, [adminToken, loadTables])

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
            acc[column] = row[column] ?? ''
            return acc
        }, {})

        setFormMode('edit')
        setSelectedId(row.id)
        setFormData(nextData)
    }

    const handleFieldChange = (column, value) => {
        setFormData((prev) => ({
            ...prev,
            [column]: value,
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
                                                    <input
                                                        type="text"
                                                        value={String(formData[column] ?? '')}
                                                        onChange={(event) =>
                                                            handleFieldChange(column, event.target.value)
                                                        }
                                                    />
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
