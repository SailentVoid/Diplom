require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')
const { Pool } = require('pg')

const app = express()
app.use(express.json())
app.use(
    cors({
        origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5174',
        ],
        credentials: true,
    })
)

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})

const JWT_SECRET = process.env.DB_SECRET || 'change-me-in-env'
const ADMIN_JWT_SECRET = process.env.ADMIN_SECRET || `${JWT_SECRET}-admin`
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const PASSWORD_RESET_CODE_TTL_MINUTES = Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES) || 10
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASSWORD = process.env.SMTP_PASSWORD
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || 'no-reply@barvodokanal.by'
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME
const TELEGRAM_PAYMENT_PROVIDER_TOKEN = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'telegram-webhook-secret'
const TELEGRAM_PAYMENT_CURRENCY = process.env.TELEGRAM_PAYMENT_CURRENCY || 'BYN'
const TELEGRAM_PAYMENT_MODE = process.env.TELEGRAM_PAYMENT_MODE || 'provider'
const TELEGRAM_STAR_BYN_RATE = Number(process.env.TELEGRAM_STAR_BYN_RATE) || 0.1
const PORT = Number(process.env.PORT) || 3000
const schemaPath = path.join(__dirname, 'db', 'schema.sql')
const schemaSql = fs.readFileSync(schemaPath, 'utf8').replace(/^\uFEFF/, '')
const migrationPath = path.join(__dirname, 'db', 'migrate_v2.sql')
const migrationSql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8').replace(/^\uFEFF/, '') : null

const WATER_TYPES = ['hot_water', 'cold_water']
const WATER_TYPE_LABELS = { hot_water: 'Горячая вода', cold_water: 'Холодная вода' }
const getWaterTypeLabel = (waterType) => WATER_TYPE_LABELS[waterType] || waterType
const OFFICIAL_WATER_TARIFFS = [
    { waterType: 'cold_water', rate: '1.8494', unit: 'м3' },
    // Тариф на hot_water хранит стоимость подогрева (тепловой энергии).
    // Горячая вода считается как холодная вода по расходу + подогрев:
    // сумма = расход_горячей_воды_м3 * тариф_холодной_воды + расход_горячей_воды_м3 * тариф_подогрева_Гкал.
    { waterType: 'hot_water', rate: '27.2323', unit: 'Гкал' },
]

const DEBT_TO_PAY_SQL = `
    GREATEST(0, -COALESCE(hw.amount, 0))
    + GREATEST(0, -COALESCE(cw.amount, 0))
`

const formatDate = (date = new Date()) => {
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatTimestamp = () => {
    const now = new Date()
    const date = formatDate(now)
    const time = now.toTimeString().slice(0, 8)
    return `${date} ${time}`
}

const log = (level, context, message) => {
    const timestamp = formatTimestamp()
    const levelLabel = level.toUpperCase()
    const line = `[${timestamp}] [${levelLabel}] ${context}: ${message}`
    if (level === 'error') {
        console.error(line)
    } else if (level === 'warn') {
        console.warn(line)
    } else {
        console.log(line)
    }
}

const logInfo = (context, message) => log('info', context, message)
const logError = (context, message) => log('error', context, message)
const logWarn = (context, message) => log('warn', context, message)

const adminTables = {
    registration_data: {
        title: 'Учётные записи',
        columns: ['id', 'fio', 'login', 'street', 'hot_water', 'cold_water', 'hot_water_debt', 'cold_water_debt', 'amount_to_pay', 'active_debt', 'debtor_status', 'created_at'],
        persistedColumns: ['id', 'fio', 'login', 'street', 'created_at'],
        editable: ['fio', 'login', 'street'],
        createable: ['fio', 'login', 'street', 'password'],
        selectSql: `
            SELECT
                r.id,
                r.fio,
                r.login,
                r.street,
                COALESCE(hmr.current_reading, 0)::text AS hot_water,
                COALESCE(cmr.current_reading, 0)::text AS cold_water,
                COALESCE(hd.hot_debt, 0)::text AS hot_water_debt,
                COALESCE(cd.cold_debt, 0)::text AS cold_water_debt,
                COALESCE(d.active_debt, 0)::text AS amount_to_pay,
                COALESCE(d.active_debt, 0)::text AS active_debt,
                CASE
                    WHEN COALESCE(d.active_debt, 0) > 0
                        THEN 'Должник'
                    ELSE 'Нет долга'
                END AS debtor_status,
                r.created_at
            FROM registration_data r
            LEFT JOIN water_meter_readings hmr ON hmr.registration_id = r.id AND hmr.water_type = 'hot_water'
            LEFT JOIN water_meter_readings cmr ON cmr.registration_id = r.id AND cmr.water_type = 'cold_water'
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS hot_debt
                FROM debtors
                WHERE registration_id = r.id
                  AND reason LIKE 'Начисление по показаниям счетчика: Горячая вода%'
            ) hd ON TRUE
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS cold_debt
                FROM debtors
                WHERE registration_id = r.id
                  AND reason LIKE 'Начисление по показаниям счетчика: Холодная вода%'
            ) cd ON TRUE
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS active_debt
                FROM debtors
                WHERE registration_id = r.id
            ) d ON TRUE
            ORDER BY r.id ASC
        `,
        selectByIdSql: `
            SELECT
                r.id,
                r.fio,
                r.login,
                r.street,
                COALESCE(hmr.current_reading, 0)::text AS hot_water,
                COALESCE(cmr.current_reading, 0)::text AS cold_water,
                COALESCE(hd.hot_debt, 0)::text AS hot_water_debt,
                COALESCE(cd.cold_debt, 0)::text AS cold_water_debt,
                COALESCE(d.active_debt, 0)::text AS amount_to_pay,
                COALESCE(d.active_debt, 0)::text AS active_debt,
                CASE
                    WHEN COALESCE(d.active_debt, 0) > 0
                        THEN 'Должник'
                    ELSE 'Нет долга'
                END AS debtor_status,
                r.created_at
            FROM registration_data r
            LEFT JOIN water_meter_readings hmr ON hmr.registration_id = r.id AND hmr.water_type = 'hot_water'
            LEFT JOIN water_meter_readings cmr ON cmr.registration_id = r.id AND cmr.water_type = 'cold_water'
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS hot_debt
                FROM debtors
                WHERE registration_id = r.id
                  AND reason LIKE 'Начисление по показаниям счетчика: Горячая вода%'
            ) hd ON TRUE
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS cold_debt
                FROM debtors
                WHERE registration_id = r.id
                  AND reason LIKE 'Начисление по показаниям счетчика: Холодная вода%'
            ) cd ON TRUE
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS active_debt
                FROM debtors
                WHERE registration_id = r.id
            ) d ON TRUE
            WHERE r.id = $1
        `,
    },
    personalization_data: {
        title: 'Данные персонализации',
        columns: [
            'id',
            'user_fio',
            'full_name',
            'birth_date',
            'phone',
            'email',
            'residential_address',
            'registration_address',
            'created_at',
            'updated_at',
        ],
        persistedColumns: ['id', 'registration_id', 'full_name', 'birth_date', 'phone', 'email', 'residential_address', 'registration_address', 'created_at', 'updated_at'],
        editable: [
            'full_name',
            'birth_date',
            'phone',
            'email',
            'residential_address',
            'registration_address',
        ],
        createable: [],
        selectSql: `
            SELECT
                p.id,
                p.registration_id,
                COALESCE(r.fio, 'Пользователь #' || p.registration_id) AS user_fio,
                p.full_name,
                p.birth_date,
                p.phone,
                p.email,
                p.residential_address,
                p.registration_address,
                p.created_at,
                p.updated_at
            FROM personalization_data p
            LEFT JOIN registration_data r ON r.id = p.registration_id
            ORDER BY p.id ASC
        `,
        selectByIdSql: `
            SELECT
                p.id,
                p.registration_id,
                COALESCE(r.fio, 'Пользователь #' || p.registration_id) AS user_fio,
                p.full_name,
                p.birth_date,
                p.phone,
                p.email,
                p.residential_address,
                p.registration_address,
                p.created_at,
                p.updated_at
            FROM personalization_data p
            LEFT JOIN registration_data r ON r.id = p.registration_id
            WHERE p.id = $1
        `,
    },
    admins: {
        title: 'Админы',
        columns: ['id', 'user_fio', 'login', 'role', 'is_active', 'created_at'],
        persistedColumns: ['id', 'registration_id', 'login', 'role', 'is_active', 'created_at'],
        editable: ['registration_id', 'login', 'role', 'is_active'],
        createable: [],
        selectSql: `
            SELECT a.id, a.registration_id, COALESCE(r.fio, 'Пользователь #' || a.registration_id) AS user_fio, a.login, a.role, a.is_active, a.created_at
            FROM admins a
            LEFT JOIN registration_data r ON r.id = a.registration_id
            ORDER BY a.id ASC
        `,
        selectByIdSql: `
            SELECT a.id, a.registration_id, COALESCE(r.fio, 'Пользователь #' || a.registration_id) AS user_fio, a.login, a.role, a.is_active, a.created_at
            FROM admins a
            LEFT JOIN registration_data r ON r.id = a.registration_id
            WHERE a.id = $1
        `,
    },
    water_balances: {
        title: 'Задолженность воды',
        columns: ['id', 'user_fio', 'login', 'water_type_label', 'amount', 'currency', 'debtor_status', 'updated_at'],
        persistedColumns: ['id', 'registration_id', 'water_type', 'amount', 'currency', 'updated_at'],
        editable: ['registration_id', 'water_type', 'amount', 'currency'],
        createable: ['registration_id', 'water_type', 'amount', 'currency'],
        selectSql: `
            SELECT
                wb.id,
                wb.registration_id,
                COALESCE(r.fio, 'Пользователь #' || wb.registration_id) AS user_fio,
                r.login,
                CASE wb.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE wb.water_type END AS water_type_label,
                wb.amount::text AS amount,
                wb.currency,
                CASE WHEN wb.amount < 0 THEN 'Должник' ELSE 'Нет долга' END AS debtor_status,
                wb.updated_at
            FROM water_balances wb
            LEFT JOIN registration_data r ON r.id = wb.registration_id
            ORDER BY wb.id ASC
        `,
        selectByIdSql: `
            SELECT
                wb.id,
                wb.registration_id,
                COALESCE(r.fio, 'Пользователь #' || wb.registration_id) AS user_fio,
                r.login,
                CASE wb.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE wb.water_type END AS water_type_label,
                wb.amount::text AS amount,
                wb.currency,
                CASE WHEN wb.amount < 0 THEN 'Должник' ELSE 'Нет долга' END AS debtor_status,
                wb.updated_at
            FROM water_balances wb
            LEFT JOIN registration_data r ON r.id = wb.registration_id
            WHERE wb.id = $1
        `,
    },

    water_meter_readings: {
        title: 'Показания счетчиков',
        columns: ['id', 'user_fio', 'login', 'water_type_label', 'current_reading', 'unit', 'updated_at'],
        persistedColumns: ['id', 'registration_id', 'water_type', 'current_reading', 'unit', 'updated_at'],
        editable: ['registration_id', 'water_type', 'current_reading', 'unit'],
        createable: ['registration_id', 'water_type', 'current_reading', 'unit'],
        selectSql: `
            SELECT
                wmr.id,
                wmr.registration_id,
                COALESCE(r.fio, 'Пользователь #' || wmr.registration_id) AS user_fio,
                r.login,
                CASE wmr.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE wmr.water_type END AS water_type_label,
                wmr.current_reading::text AS current_reading,
                wmr.unit,
                wmr.updated_at
            FROM water_meter_readings wmr
            LEFT JOIN registration_data r ON r.id = wmr.registration_id
            ORDER BY wmr.id ASC
        `,
        selectByIdSql: `
            SELECT
                wmr.id,
                wmr.registration_id,
                COALESCE(r.fio, 'Пользователь #' || wmr.registration_id) AS user_fio,
                r.login,
                CASE wmr.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE wmr.water_type END AS water_type_label,
                wmr.current_reading::text AS current_reading,
                wmr.unit,
                wmr.updated_at
            FROM water_meter_readings wmr
            LEFT JOIN registration_data r ON r.id = wmr.registration_id
            WHERE wmr.id = $1
        `,
    },
    debtors: {
        title: 'Должники',
        columns: [
            'id',
            'user_fio',
            'debt_amount',
            'reason',
            'is_active',
            'created_at',
            'closed_at',
        ],
        persistedColumns: ['id', 'registration_id', 'debt_amount', 'reason', 'is_active', 'created_at', 'closed_at'],
        editable: ['registration_id', 'debt_amount', 'reason', 'is_active', 'closed_at'],
        createable: ['registration_id', 'debt_amount', 'reason', 'is_active', 'closed_at'],
        selectSql: `
            SELECT d.id, d.registration_id, COALESCE(r.fio, 'Пользователь #' || d.registration_id) AS user_fio, d.debt_amount::text AS debt_amount, d.reason, d.is_active, d.created_at, d.closed_at
            FROM debtors d
            LEFT JOIN registration_data r ON r.id = d.registration_id
            ORDER BY d.id DESC
        `,
        selectByIdSql: `
            SELECT d.id, d.registration_id, COALESCE(r.fio, 'Пользователь #' || d.registration_id) AS user_fio, d.debt_amount::text AS debt_amount, d.reason, d.is_active, d.created_at, d.closed_at
            FROM debtors d
            LEFT JOIN registration_data r ON r.id = d.registration_id
            WHERE d.id = $1
        `,
    },
    telegram_payment_orders: {
        title: 'Платежи',
        columns: [
            'id',
            'user_fio',
            'amount',
            'currency',
            'payment_method',
            'invoice_currency',
            'invoice_amount',
            'status',
            'telegram_payload',
            'telegram_chat_id',
            'telegram_username',
            'description',
            'telegram_payment_charge_id',
            'provider_payment_charge_id',
            'created_at',
            'invoice_sent_at',
            'paid_at',
        ],
        persistedColumns: ['id', 'registration_id', 'amount', 'currency', 'payment_method', 'invoice_currency', 'invoice_amount', 'status', 'telegram_payload', 'telegram_chat_id', 'telegram_username', 'description', 'telegram_payment_charge_id', 'provider_payment_charge_id', 'created_at', 'invoice_sent_at', 'paid_at'],
        editable: ['status', 'description'],
        createable: [],
        selectSql: `
            SELECT
                tpo.id,
                tpo.registration_id,
                COALESCE(r.fio, 'Пользователь #' || tpo.registration_id) AS user_fio,
                tpo.amount::text AS amount,
                tpo.currency,
                tpo.payment_method,
                tpo.invoice_currency,
                tpo.invoice_amount,
                tpo.status,
                tpo.telegram_payload,
                tpo.telegram_chat_id,
                tpo.telegram_username,
                tpo.description,
                tpo.telegram_payment_charge_id,
                tpo.provider_payment_charge_id,
                tpo.created_at,
                tpo.invoice_sent_at,
                tpo.paid_at
            FROM telegram_payment_orders tpo
            LEFT JOIN registration_data r ON r.id = tpo.registration_id
            ORDER BY tpo.id DESC
        `,
        selectByIdSql: `
            SELECT
                tpo.id,
                tpo.registration_id,
                COALESCE(r.fio, 'Пользователь #' || tpo.registration_id) AS user_fio,
                tpo.amount::text AS amount,
                tpo.currency,
                tpo.payment_method,
                tpo.invoice_currency,
                tpo.invoice_amount,
                tpo.status,
                tpo.telegram_payload,
                tpo.telegram_chat_id,
                tpo.telegram_username,
                tpo.description,
                tpo.telegram_payment_charge_id,
                tpo.provider_payment_charge_id,
                tpo.created_at,
                tpo.invoice_sent_at,
                tpo.paid_at
            FROM telegram_payment_orders tpo
            LEFT JOIN registration_data r ON r.id = tpo.registration_id
            WHERE tpo.id = $1
        `,
    },
    tariffs: {
        title: 'Тарифы',
        columns: ['id', 'water_type_label', 'rate_per_unit', 'unit', 'currency', 'effective_from', 'is_active', 'created_at'],
        persistedColumns: ['id', 'water_type', 'rate_per_unit', 'unit', 'currency', 'effective_from', 'is_active', 'created_at'],
        editable: ['water_type', 'rate_per_unit', 'unit', 'currency', 'effective_from', 'is_active'],
        createable: ['water_type', 'rate_per_unit', 'unit', 'currency', 'effective_from', 'is_active'],
        selectSql: `
            SELECT
                t.id,
                t.water_type,
                CASE t.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE t.water_type END AS water_type_label,
                t.rate_per_unit::text AS rate_per_unit,
                t.unit,
                t.currency,
                t.effective_from,
                t.is_active,
                t.created_at
            FROM tariffs t
            WHERE t.is_active = TRUE
            ORDER BY t.water_type, t.effective_from DESC
        `,
        selectByIdSql: `
            SELECT
                t.id,
                t.water_type,
                CASE t.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE t.water_type END AS water_type_label,
                t.rate_per_unit::text AS rate_per_unit,
                t.unit,
                t.currency,
                t.effective_from,
                t.is_active,
                t.created_at
            FROM tariffs t
            WHERE t.id = $1
        `,
    },
    fake_payments: {
        title: 'Тестовые платежи',
        columns: ['id', 'user_fio', 'login', 'water_type_label', 'previous_reading', 'current_reading', 'consumption', 'tariff_rate', 'unit', 'amount', 'currency', 'description', 'status', 'created_at'],
        persistedColumns: ['id', 'registration_id', 'water_type', 'previous_reading', 'current_reading', 'consumption', 'tariff_rate', 'unit', 'amount', 'currency', 'description', 'status', 'created_at'],
        editable: ['status', 'description'],
        createable: [],
        selectSql: `
            SELECT
                fp.id,
                fp.registration_id,
                COALESCE(r.fio, 'Пользователь #' || fp.registration_id) AS user_fio,
                r.login,
                CASE fp.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE fp.water_type END AS water_type_label,
                fp.previous_reading::text AS previous_reading,
                fp.current_reading::text AS current_reading,
                fp.consumption::text AS consumption,
                fp.tariff_rate::text AS tariff_rate,
                CASE fp.water_type WHEN 'hot_water' THEN 'м3' ELSE fp.unit END AS unit,
                fp.amount::text AS amount,
                fp.currency,
                fp.description,
                fp.status,
                fp.created_at
            FROM fake_payments fp
            LEFT JOIN registration_data r ON r.id = fp.registration_id
            ORDER BY fp.id DESC
        `,
        selectByIdSql: `
            SELECT
                fp.id,
                fp.registration_id,
                COALESCE(r.fio, 'Пользователь #' || fp.registration_id) AS user_fio,
                r.login,
                CASE fp.water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE fp.water_type END AS water_type_label,
                fp.previous_reading::text AS previous_reading,
                fp.current_reading::text AS current_reading,
                fp.consumption::text AS consumption,
                fp.tariff_rate::text AS tariff_rate,
                CASE fp.water_type WHEN 'hot_water' THEN 'м3' ELSE fp.unit END AS unit,
                fp.amount::text AS amount,
                fp.currency,
                fp.description,
                fp.status,
                fp.created_at
            FROM fake_payments fp
            LEFT JOIN registration_data r ON r.id = fp.registration_id
            WHERE fp.id = $1
        `,
    },
}

const getAdminTable = (tableName) => adminTables[tableName]

const getAdminTableColumns = (table) => table.persistedColumns || table.columns

const getAdminRows = (db, tableName, table) => {
    if (table.selectSql) {
        return db.query(table.selectSql)
    }

    return db.query(
        `
            SELECT ${table.columns.join(', ')}
            FROM ${tableName}
            ORDER BY id ASC
        `
    )
}

const getAdminRow = (db, tableName, table, id) => {
    if (table.selectByIdSql) {
        return db.query(table.selectByIdSql, [id])
    }

    return db.query(
        `
            SELECT ${table.columns.join(', ')}
            FROM ${tableName}
            WHERE id = $1
        `,
        [id]
    )
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+375\(\d{2}\)\d{3}-\d{2}-\d{2}$/
const BIRTH_DATE_PATTERN = /^\d{2}\.\d{2}\.\d{4}$/

const parseRuDateToIso = (value) => {
    if (!value) {
        return ''
    }

    const raw = String(value).trim()

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw
    }

    const match = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)

    if (!match) {
        return null
    }

    const [, day, month, year] = match
    const dayNumber = Number(day)
    const monthNumber = Number(month)
    const yearNumber = Number(year)

    if (yearNumber < 1 || yearNumber > 9999 || monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
        return null
    }

    const date = new Date(`${year}-${month}-${day}T00:00:00Z`)

    if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== yearNumber ||
        date.getUTCMonth() + 1 !== monthNumber ||
        date.getUTCDate() !== dayNumber
    ) {
        return null
    }

    return `${year}-${month}-${day}`
}

const validateContactFields = (payload, { requireBirthDate = false } = {}) => {
    if (Object.hasOwn(payload, 'email') && payload.email) {
        if (!EMAIL_PATTERN.test(String(payload.email).trim())) {
            return 'Ошибка в почте: укажите email по шаблону example1@Exammp.com'
        }
    }

    if (Object.hasOwn(payload, 'phone') && payload.phone) {
        if (!PHONE_PATTERN.test(String(payload.phone).trim())) {
            return 'Ошибка в телефоне: укажите номер по шаблону +375(11)222-33-44'
        }
    }

    if ((requireBirthDate || Object.hasOwn(payload, 'birth_date') || Object.hasOwn(payload, 'birthDate')) && (payload.birth_date || payload.birthDate)) {
        const source = payload.birth_date || payload.birthDate
        if (!BIRTH_DATE_PATTERN.test(String(source).trim()) || !parseRuDateToIso(source)) {
            return 'Ошибка с датой рождения: укажите дату по шаблону 11.06.2007'
        }
    }

    return null
}

const validateRequiredFields = (payload, fields) => {
    for (const { key, label } of fields) {
        if (!payload[key] || !String(payload[key]).trim()) {
            return `Ошибка в поле «${label}»: поле обязательно для заполнения`
        }
    }

    return null
}

const validateAdminPayload = (tableName, payload, mode = 'create') => {
    if (tableName === 'registration_data') {
        if (!payload.fio || !String(payload.fio).trim()) return 'Ошибка в ФИО: поле обязательно для заполнения'
        if (!payload.login || !String(payload.login).trim()) return 'Ошибка в логине: поле обязательно для заполнения'
        if (!payload.street || !String(payload.street).trim()) return 'Ошибка в адресе: поле обязательно для заполнения'
        if (mode === 'create' && (!payload.password || String(payload.password).length < 3)) {
            return 'Ошибка в пароле: укажите пароль минимум из 3 символов'
        }
    }

    if (tableName === 'personalization_data') {
        const requiredError = validateRequiredFields(payload, [
            { key: 'full_name', label: 'ФИО' },
            { key: 'birth_date', label: 'Дата рождения' },
            { key: 'phone', label: 'Телефон' },
            { key: 'email', label: 'Email' },
            { key: 'residential_address', label: 'Адрес проживания' },
            { key: 'registration_address', label: 'Адрес регистрации' },
        ])
        if (requiredError) return requiredError

        const contactError = validateContactFields(payload)
        if (contactError) return contactError
    }

    if (['water_balances', 'water_meter_readings', 'debtors'].includes(tableName)) {
        if (!payload.registration_id || !String(payload.registration_id).trim()) {
            return 'Ошибка в поле «ФИО пользователя»: выберите пользователя из списка'
        }
    }

    if (tableName === 'tariffs' && payload.water_type && !WATER_TYPES.includes(payload.water_type)) {
        return 'Ошибка в типе воды: выберите «Горячая вода» или «Холодная вода»'
    }

    return null
}

const normalizeAdminValue = (value, column = '') => {
    if (value === '') {
        return null
    }

    if (column === 'birth_date' || column === 'effective_from' || column === 'closed_at') {
        return parseRuDateToIso(value) || value
    }

    return typeof value === 'string' ? value.trim() : value
}

const mailTransporter = SMTP_HOST
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER && SMTP_PASSWORD
            ? {
                user: SMTP_USER,
                pass: SMTP_PASSWORD,
            }
            : undefined,
    })
    : null

const normalizeEmail = (email) => email.trim().toLowerCase()

const generatePasswordResetCode = () => String(crypto.randomInt(100000, 1000000))

const hashPasswordResetCode = (email, code) =>
    crypto
        .createHash('sha256')
        .update(`${normalizeEmail(email)}:${code}:${JWT_SECRET}`)
        .digest('hex')

const sendPasswordResetEmail = async (email, code) => {
    if (!mailTransporter) {
        logInfo('Сброс пароля', `Код для ${email}: ${code}`)
        return
    }

    await mailTransporter.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: 'Код восстановления пароля',
        text: `Ваш код восстановления пароля: ${code}. Код действует ${PASSWORD_RESET_CODE_TTL_MINUTES} минут.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2>Восстановление пароля</h2>
                <p>Ваш код восстановления:</p>
                <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
                <p>Код действует ${PASSWORD_RESET_CODE_TTL_MINUTES} минут.</p>
            </div>
        `,
    })
}

const normalizePaymentAmount = (value) => {
    const amount = Number(value)

    if (!Number.isFinite(amount)) {
        return null
    }

    return Math.round(amount * 100) / 100
}


const normalizeMeterReading = (value) => {
    if (value === undefined || value === null || value === '') {
        return null
    }

    const reading = Number(value)

    if (!Number.isFinite(reading)) {
        return null
    }

    return Math.round(reading * 1000) / 1000
}

const getActiveTariff = async (client, waterType) => {
    const result = await client.query(
        `
            SELECT rate_per_unit::text AS rate_per_unit, unit, currency
            FROM tariffs
            WHERE water_type = $1 AND is_active = TRUE
            ORDER BY effective_from DESC, id DESC
            LIMIT 1
        `,
        [waterType]
    )

    const fallback = OFFICIAL_WATER_TARIFFS.find((tariff) => tariff.waterType === waterType)

    return {
        rate: Number(result.rows[0]?.rate_per_unit || fallback?.rate || 0),
        unit: result.rows[0]?.unit || fallback?.unit || 'м3',
        currency: result.rows[0]?.currency || TELEGRAM_PAYMENT_CURRENCY,
    }
}

const normalizeTelegramPaymentMode = () =>
    TELEGRAM_PAYMENT_MODE === 'stars' ? 'telegram_stars' : 'telegram_provider'

const getTelegramInvoiceCurrency = () =>
    normalizeTelegramPaymentMode() === 'telegram_stars' ? 'XTR' : TELEGRAM_PAYMENT_CURRENCY

const calculateTelegramInvoiceAmount = (amount) => {
    if (normalizeTelegramPaymentMode() === 'telegram_stars') {
        return Math.max(1, Math.ceil(Number(amount) / TELEGRAM_STAR_BYN_RATE))
    }

    return Math.round(Number(amount) * 100)
}

const AUTO_DEBT_REASON = 'Автоматически создано: отрицательный баланс'
const METER_READING_DEBT_REASON_PREFIX = 'Начисление по показаниям счетчика'


const syncNegativeBalanceDebt = async (
    client,
    balanceRow,
    { actorType = 'system', actorId = null, actorLogin = 'system', ipAddress = null } = {}
) => {
    const registrationId = balanceRow?.registration_id
    const waterType = balanceRow?.water_type || 'hot_water'
    const balanceAmount = normalizePaymentAmount(balanceRow?.amount || 0)

    if (!registrationId || balanceAmount === null) {
        return null
    }

    const waterLabel = WATER_TYPE_LABELS[waterType] || waterType
    const autoDebtReason = `${AUTO_DEBT_REASON} (${waterLabel})`

    const activeDebtResult = await client.query(
        `
            SELECT id, debt_amount::text AS debt_amount
            FROM debtors
            WHERE registration_id = $1
              AND reason = $2
              AND is_active = TRUE
            ORDER BY id ASC
            FOR UPDATE
        `,
        [registrationId, autoDebtReason]
    )

    if (balanceAmount < 0) {
        const debtAmount = Math.abs(balanceAmount)
        const currentDebt = activeDebtResult.rows[0]

        if (currentDebt) {
            const previousDebtAmount = normalizePaymentAmount(currentDebt.debt_amount)

            await client.query(
                `
                    UPDATE debtors
                    SET debt_amount = $1,
                        is_active = TRUE,
                        closed_at = NULL
                    WHERE id = $2
                `,
                [debtAmount, currentDebt.id]
            )

            if (activeDebtResult.rows.length > 1) {
                await client.query(
                    `
                        UPDATE debtors
                        SET debt_amount = 0,
                            is_active = FALSE,
                            closed_at = CURRENT_DATE
                        WHERE id = ANY($1::bigint[])
                    `,
                    [activeDebtResult.rows.slice(1).map((debt) => debt.id)]
                )
            }

            if (previousDebtAmount !== debtAmount) {
                await createAuditLog(
                    {
                        actorType,
                        actorId,
                        actorLogin,
                        action: 'balance_auto_debtor_updated',
                        entityTable: 'debtors',
                        entityId: currentDebt.id,
                        changes: {
                            debt_amount: {
                                from: previousDebtAmount,
                                to: debtAmount,
                            },
                            reason: autoDebtReason,
                        },
                        ipAddress,
                    },
                    client
                )
            }

            return { debtId: currentDebt.id, debtAmount }
        }

        const insertedDebt = await client.query(
            `
                INSERT INTO debtors (registration_id, debt_amount, reason, is_active)
                VALUES ($1, $2, $3, TRUE)
                RETURNING id
            `,
            [registrationId, debtAmount, autoDebtReason]
        )
        const debtId = insertedDebt.rows[0].id

        await createAuditLog(
            {
                actorType,
                actorId,
                actorLogin,
                action: 'balance_auto_debtor_created',
                entityTable: 'debtors',
                entityId: debtId,
                changes: {
                    after: {
                        registration_id: registrationId,
                        debt_amount: debtAmount,
                        reason: autoDebtReason,
                        is_active: true,
                    },
                },
                ipAddress,
            },
            client
        )

        return { debtId, debtAmount }
    }

    if (activeDebtResult.rows.length === 0) {
        return null
    }

    await client.query(
        `
            UPDATE debtors
            SET debt_amount = 0,
                is_active = FALSE,
                closed_at = CURRENT_DATE
            WHERE id = ANY($1::bigint[])
        `,
        [activeDebtResult.rows.map((debt) => debt.id)]
    )

    await createAuditLog(
        {
            actorType,
            actorId,
            actorLogin,
            action: 'balance_auto_debtor_closed',
            entityTable: 'debtors',
            entityId: activeDebtResult.rows[0].id,
            changes: {
                before: activeDebtResult.rows,
                after: {
                    debt_amount: 0,
                    is_active: false,
                    reason: autoDebtReason,
                },
            },
            ipAddress,
        },
        client
    )

    return null
}

const serializePaymentOrder = (order) => ({
    id: Number(order.id),
    registrationId: Number(order.registration_id),
    amount: Number(order.amount),
    currency: order.currency,
    paymentMethod: order.payment_method,
    invoiceCurrency: order.invoice_currency,
    invoiceAmount: Number(order.invoice_amount),
    status: order.status,
    telegramPayload: order.telegram_payload,
    telegramChatId: order.telegram_chat_id ? Number(order.telegram_chat_id) : null,
    telegramUsername: order.telegram_username,
    description: order.description,
    createdAt: order.created_at,
    invoiceSentAt: order.invoice_sent_at,
    paidAt: order.paid_at,
})

const isTelegramPaymentsConfigured = () =>
    Boolean(
        TELEGRAM_BOT_TOKEN &&
        TELEGRAM_BOT_USERNAME &&
        (normalizeTelegramPaymentMode() === 'telegram_stars' || TELEGRAM_PAYMENT_PROVIDER_TOKEN)
    )

const buildTelegramPaymentLink = (payload) => {
    if (!TELEGRAM_BOT_USERNAME) {
        return null
    }

    return `https://t.me/${TELEGRAM_BOT_USERNAME.replace(/^@/, '')}?start=${encodeURIComponent(payload)}`
}

const telegramBotApi = async (method, body) => {
    if (!TELEGRAM_BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN is not configured')
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })
    const payload = await response.json()

    if (!payload.ok) {
        throw new Error(payload.description || `Telegram Bot API ${method} failed`)
    }

    return payload.result
}

const sendTelegramMessage = (chatId, text) =>
    telegramBotApi('sendMessage', {
        chat_id: chatId,
        text,
    })

const sendTelegramInvoice = (chatId, order) =>
    telegramBotApi('sendInvoice', {
        chat_id: chatId,
        title: 'Оплата услуг водоснабжения',
        description: order.description || 'Оплата услуг водоснабжения (горячая/холодная вода)',
        payload: order.telegram_payload,
        provider_token:
            normalizeTelegramPaymentMode() === 'telegram_stars' ? '' : TELEGRAM_PAYMENT_PROVIDER_TOKEN,
        currency: order.invoice_currency,
        prices: [
            {
                label: order.invoice_currency === 'XTR' ? 'Telegram Stars' : 'Сумма к оплате',
                amount: Number(order.invoice_amount),
            },
        ],
        start_parameter: order.telegram_payload,
    })

const applyTelegramPaymentToAccount = async (client, registrationId, amount) => {
    let remaining = normalizePaymentAmount(amount)
    let appliedToDebt = 0

    const debtResult = await client.query(
        `
            SELECT id, debt_amount::text AS debt_amount, reason
            FROM debtors
            WHERE registration_id = $1 AND is_active = TRUE
            ORDER BY created_at, id
            FOR UPDATE
        `,
        [registrationId]
    )

    for (const debt of debtResult.rows) {
        if (remaining <= 0) {
            break
        }

        const debtAmount = normalizePaymentAmount(debt.debt_amount)
        const paidPart = Math.min(remaining, debtAmount)
        const newDebtAmount = normalizePaymentAmount(debtAmount - paidPart)

        if (newDebtAmount <= 0) {
            await client.query(
                `
                    UPDATE debtors
                    SET debt_amount = 0, is_active = FALSE, closed_at = CURRENT_DATE
                    WHERE id = $1
                `,
                [debt.id]
            )
        } else {
            await client.query(
                `
                    UPDATE debtors
                    SET debt_amount = $1
                    WHERE id = $2
                `,
                [newDebtAmount, debt.id]
            )
        }

        appliedToDebt = normalizePaymentAmount(appliedToDebt + paidPart)
        remaining = normalizePaymentAmount(remaining - paidPart)
    }

    if (remaining > 0) {
        const halfAmount = normalizePaymentAmount(remaining / 2)
        const hotAmount = normalizePaymentAmount(remaining - halfAmount)

        for (const wt of WATER_TYPES) {
            const creditAmount = wt === 'hot_water' ? hotAmount : halfAmount
            if (creditAmount > 0) {
                await client.query(
                    `
                        INSERT INTO water_balances (registration_id, water_type, amount, currency)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (registration_id, water_type) DO UPDATE
                        SET amount = water_balances.amount + EXCLUDED.amount,
                            currency = EXCLUDED.currency,
                            updated_at = CURRENT_DATE
                    `,
                    [registrationId, wt, creditAmount, TELEGRAM_PAYMENT_CURRENCY]
                )
            }
        }
    }

    return {
        appliedToDebt,
        addedToBalance: remaining > 0 ? remaining : 0,
    }
}

const markTelegramPaymentPaid = async (telegramPayload, successfulPayment, rawUpdate) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const orderResult = await client.query(
            `
                SELECT *
                FROM telegram_payment_orders
                WHERE telegram_payload = $1
                FOR UPDATE
            `,
            [telegramPayload]
        )

        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return null
        }

        const order = orderResult.rows[0]

        if (order.status === 'paid') {
            await client.query('COMMIT')
            return serializePaymentOrder(order)
        }

        const application = await applyTelegramPaymentToAccount(client, order.registration_id, order.amount)
        const paidOrderResult = await client.query(
            `
                UPDATE telegram_payment_orders
                SET status = 'paid',
                    telegram_payment_charge_id = $1,
                    provider_payment_charge_id = $2,
                    raw_update = $3,
                    paid_at = CURRENT_DATE
                WHERE id = $4
                RETURNING *
            `,
            [
                successfulPayment.telegram_payment_charge_id || null,
                successfulPayment.provider_payment_charge_id || null,
                rawUpdate,
                order.id,
            ]
        )

        await createAuditLog(
            {
                actorType: 'system',
                actorId: order.registration_id,
                actorLogin: 'telegram_bot',
                action: 'telegram_payment_paid',
                entityTable: 'telegram_payment_orders',
                entityId: order.id,
                changes: {
                    after: {
                        status: 'paid',
                        amount: Number(order.amount),
                        currency: order.currency,
                        application,
                    },
                },
            },
            client
        )

        await client.query('COMMIT')

        return serializePaymentOrder(paidOrderResult.rows[0])
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

const auditClients = new Set()

const normalizeAuditValue = (value) => {
    if (value instanceof Date) {
        return value.toISOString()
    }

    return value
}

const buildAuditChanges = (before, after, columns) =>
    columns.reduce((changes, column) => {
        const beforeValue = normalizeAuditValue(before?.[column] ?? null)
        const afterValue = normalizeAuditValue(after?.[column] ?? null)

        if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
            changes[column] = {
                from: beforeValue,
                to: afterValue,
            }
        }

        return changes
    }, {})

const emitAuditLog = (log) => {
    const payload = JSON.stringify(log)

    auditClients.forEach((client) => {
        client.write(`event: audit-log\ndata: ${payload}\n\n`)
    })
}

const createAuditLog = async (
    {
        actorType,
        actorId,
        actorLogin,
        action,
        entityTable,
        entityId,
        changes,
        ipAddress,
    },
    db = pool
) => {
    const result = await db.query(
        `
            INSERT INTO audit_logs (
                actor_type,
                actor_id,
                actor_login,
                action,
                entity_table,
                entity_id,
                changes,
                ip_address
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, actor_type, actor_id, actor_login, action, entity_table, entity_id, changes, ip_address, created_at
        `,
        [
            actorType,
            actorId,
            actorLogin,
            action,
            entityTable,
            entityId,
            changes || {},
            ipAddress,
        ]
    )

    emitAuditLog(result.rows[0])

    return result.rows[0]
}


const getDatabaseErrorMessage = (error, operation = 'сохранения') => {
    const detail = error?.detail || error?.message || ''

    if (error?.code === '23502') {
        const columnLabels = {
            registration_id: 'ФИО пользователя',
            fio: 'ФИО',
            login: 'Логин',
            street: 'Адрес',
            password_hash: 'Пароль',
            birth_date: 'Дата рождения',
            phone: 'Телефон',
            email: 'Email',
        }
        const column = columnLabels[error?.column] || error?.column

        return `Ошибка ${operation} записи: поле «${column || 'обязательное поле'}» обязательно для заполнения`
    }

    if (error?.code === '23505') {
        if (detail.includes('login')) {
            return `Ошибка ${operation} записи: такой логин уже существует`
        }

        if (detail.includes('registration_id')) {
            return `Ошибка ${operation} записи: для этого пользователя такая связанная запись уже существует`
        }

        return `Ошибка ${operation} записи: такая запись уже существует`
    }

    if (error?.code === '23503') {
        return `Ошибка ${operation} записи: выбранного пользователя или связанной записи не существует`
    }

    if (error?.code === '23514') {
        return `Ошибка ${operation} записи: значение не проходит ограничение таблицы`
    }

    if (error?.code === '22P02') {
        return `Ошибка ${operation} записи: неверный формат числа, даты или ID`
    }

    return `Ошибка ${operation} записи: ${detail || 'проверьте заполнение полей'}`
}

const verifyAdminToken = (token) => {
    try {
        const admin = jwt.verify(token, ADMIN_JWT_SECRET)

        if (admin.role !== 'admin') {
            return null
        }

        return admin
    } catch {
        return null
    }
}

const createSchema = async () => {
    await pool.query(schemaSql)
}

const syncExistingBalanceDebts = async () => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const balancesResult = await client.query(
            `
                SELECT id, registration_id, water_type, amount::text AS amount
                FROM water_balances
                ORDER BY id ASC
                FOR UPDATE
            `
        )

        for (const balance of balancesResult.rows) {
            await syncNegativeBalanceDebt(client, balance)
        }

        await client.query('COMMIT')
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

const migrateLegacyUsers = async () => {
    const legacyTable = await pool.query("SELECT to_regclass('public.users') AS table_name")

    if (!legacyTable.rows[0].table_name) {
        return
    }

    await pool.query(`
        INSERT INTO registration_data (fio, login, street, password_hash)
        SELECT u.fio, u.login, u.street, u.password
        FROM users u
        ON CONFLICT (login) DO NOTHING
    `)

    await pool.query(`
        INSERT INTO personalization_data (registration_id, full_name, residential_address, registration_address)
        SELECT r.id, r.fio, r.street, r.street
        FROM registration_data r
        LEFT JOIN personalization_data p ON p.registration_id = r.id
        WHERE p.id IS NULL
    `)

    await pool.query(`
        INSERT INTO water_balances (registration_id, water_type, amount)
        SELECT r.id, 'hot_water', 0
        FROM registration_data r
        LEFT JOIN water_balances wb ON wb.registration_id = r.id AND wb.water_type = 'hot_water'
        WHERE wb.id IS NULL
    `)

    await pool.query(`
        INSERT INTO water_balances (registration_id, water_type, amount)
        SELECT r.id, 'cold_water', 0
        FROM registration_data r
        LEFT JOIN water_balances wb ON wb.registration_id = r.id AND wb.water_type = 'cold_water'
        WHERE wb.id IS NULL
    `)
}

const seedTariffs = async () => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        await client.query(
            `
                DELETE FROM tariffs
                WHERE water_type = ANY($1::text[])
            `,
            [OFFICIAL_WATER_TARIFFS.map((tariff) => tariff.waterType)]
        )

        for (const tariff of OFFICIAL_WATER_TARIFFS) {
            await client.query(
                `
                    INSERT INTO tariffs (water_type, rate_per_unit, unit, currency, effective_from, is_active)
                    VALUES ($1, $2, $3, 'BYN', DATE '2025-06-01', TRUE)
                `,
                [tariff.waterType, tariff.rate, tariff.unit]
            )
        }

        await client.query('COMMIT')
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally {
        client.release()
    }
}

const seedAdmin = async () => {
    const adminResult = await pool.query('SELECT id FROM admins WHERE login = $1', [ADMIN_LOGIN])

    if (adminResult.rows.length > 0) {
        return
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

    await pool.query(
        `
            INSERT INTO admins (login, password_hash, role, is_active)
            VALUES ($1, $2, 'admin', TRUE)
        `,
        [ADMIN_LOGIN, passwordHash]
    )
}

const initializeDatabase = async () => {
    await createSchema()
    if (migrationSql) {
        await pool.query(migrationSql)
        logInfo('Миграция', 'Миграция БД выполнена успешно')
    }
    await seedAdmin()
    await seedTariffs()
    await migrateLegacyUsers()
    await syncExistingBalanceDebts()
    logInfo('Инициализация', 'Схема БД инициализирована')
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]

    if (!token) {
        return res.status(401).json({ error: 'Токен обязателен' })
    }

    jwt.verify(token, JWT_SECRET, (error, user) => {
        if (error) {
            return res.status(403).json({ error: 'Неверный токен' })
        }

        req.user = user
        return next()
    })
}

const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]
    const admin = verifyAdminToken(token)

    if (!admin) {
        return res.status(401).json({ error: 'Токен администратора обязателен' })
    }

    req.admin = admin
    return next()
}

app.post('/api/auth/register', async (req, res) => {
    const { fio, login, street, phone, email, birthDate, password } = req.body

    const requiredError = validateRequiredFields(req.body, [
        { key: 'fio', label: 'ФИО' },
        { key: 'login', label: 'Логин' },
        { key: 'street', label: 'Адрес' },
        { key: 'phone', label: 'Телефон' },
        { key: 'email', label: 'Email' },
        { key: 'birthDate', label: 'Дата рождения' },
        { key: 'password', label: 'Пароль' },
    ])

    if (requiredError) {
        return res.status(400).json({ error: requiredError })
    }

    const contactError = validateContactFields({ phone, email, birthDate }, { requireBirthDate: true })

    if (contactError) {
        return res.status(400).json({ error: contactError })
    }

    if (String(password).length < 6) {
        return res.status(400).json({ error: 'Ошибка в пароле: укажите пароль минимум из 6 символов' })
    }

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const normalizedFio = String(fio).trim()
        const normalizedLogin = String(login).trim()
        const normalizedStreet = String(street).trim()
        const normalizedPhone = String(phone).trim()
        const normalizedEmail = normalizeEmail(email)
        const normalizedBirthDate = parseRuDateToIso(birthDate)
        const hashedPassword = await bcrypt.hash(String(password), 10)
        const registrationResult = await client.query(
            `
                INSERT INTO registration_data (fio, login, street, password_hash)
                VALUES ($1, $2, $3, $4)
                RETURNING id, fio, login, street
            `,
            [normalizedFio, normalizedLogin, normalizedStreet, hashedPassword]
        )

        const user = registrationResult.rows[0]

        await client.query(
            `
                INSERT INTO personalization_data (
                    registration_id,
                    full_name,
                    birth_date,
                    phone,
                    email,
                    residential_address,
                    registration_address
                )
                VALUES ($1, $2, $3::date, $4, $5, $6, $7)
            `,
            [
                user.id,
                normalizedFio,
                normalizedBirthDate,
                normalizedPhone,
                normalizedEmail,
                normalizedStreet,
                normalizedStreet,
            ]
        )

        await client.query(
            `
                INSERT INTO water_balances (registration_id, water_type, amount)
                VALUES ($1, 'hot_water', 0)
            `,
            [user.id]
        )

        await client.query(
            `
                INSERT INTO water_balances (registration_id, water_type, amount)
                VALUES ($1, 'cold_water', 0)
            `,
            [user.id]
        )

        await createAuditLog(
            {
                actorType: 'user',
                actorId: user.id,
                actorLogin: user.login,
                action: 'user_register',
                entityTable: 'registration_data',
                entityId: user.id,
                changes: {
                    after: {
                        id: user.id,
                        fio: user.fio,
                        login: user.login,
                        street: user.street,
                        phone: normalizedPhone,
                        email: normalizedEmail,
                        birthDate: normalizedBirthDate,
                    },
                },
                ipAddress: req.ip,
            },
            client
        )

        await client.query('COMMIT')

        return res.status(201).json({
            message: 'Регистрация выполнена успешно',
            user,
        })
    } catch (error) {
        await client.query('ROLLBACK')

        if (error.code === '23505') {
            return res.status(409).json({ error: 'Логин уже занят' })
        }

        logError('Регистрация', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка сервера при регистрации' })
    } finally {
        client.release()
    }
})

app.post('/api/auth/login', async (req, res) => {
    const { login, password } = req.body

    if (!login || !password) {
        return res.status(400).json({ error: 'Нужны логин и пароль' })
    }

    try {
        const result = await pool.query(
            'SELECT id, login, fio, password_hash FROM registration_data WHERE login = $1',
            [login]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверные данные' })
        }

        const user = result.rows[0]
        const validPassword = await bcrypt.compare(password, user.password_hash)

        if (!validPassword) {
            return res.status(401).json({ error: 'Неверные данные' })
        }

        const token = jwt.sign(
            {
                id: user.id,
                login: user.login,
                fio: user.fio,
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        )

        return res.json({
            user: {
                id: user.id,
                login: user.login,
                fio: user.fio,
            },
            token,
        })
    } catch (error) {
        logError('Вход', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка сервера' })
    }
})

app.post('/api/auth/password-reset/request', async (req, res) => {
    const { email } = req.body

    if (!email) {
        return res.status(400).json({ error: 'Укажи email' })
    }

    const normalizedEmail = normalizeEmail(email)
    const successMessage = 'Если email найден, код восстановления отправлен'

    try {
        const userResult = await pool.query(
            `
                SELECT r.id, r.login, p.email
                FROM registration_data r
                INNER JOIN personalization_data p ON p.registration_id = r.id
                WHERE LOWER(p.email) = $1
                LIMIT 1
            `,
            [normalizedEmail]
        )

        if (userResult.rows.length === 0) {
            return res.json({ message: successMessage })
        }

        const user = userResult.rows[0]
        const code = generatePasswordResetCode()
        const codeHash = hashPasswordResetCode(normalizedEmail, code)
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000)
        const client = await pool.connect()

        try {
            await client.query('BEGIN')
            await client.query(
                `
                    UPDATE password_reset_codes
                    SET used_at = CURRENT_DATE
                    WHERE registration_id = $1 AND used_at IS NULL
                `,
                [user.id]
            )

            const resetResult = await client.query(
                `
                    INSERT INTO password_reset_codes (registration_id, email, code_hash, expires_at)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `,
                [user.id, normalizedEmail, codeHash, expiresAt]
            )

            await createAuditLog(
                {
                    actorType: 'user',
                    actorId: user.id,
                    actorLogin: user.login,
                    action: 'password_reset_code_requested',
                    entityTable: 'password_reset_codes',
                    entityId: resetResult.rows[0].id,
                    changes: {
                        email: normalizedEmail,
                        expires_at: expiresAt.toISOString(),
                    },
                    ipAddress: req.ip,
                },
                client
            )

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }

        await sendPasswordResetEmail(user.email, code)

        return res.json({ message: successMessage })
    } catch (error) {
        logError('Сброс пароля (запрос)', error.message || String(error))
        return res.status(500).json({ error: 'Не удалось отправить код восстановления' })
    }
})

app.post('/api/auth/password-reset/confirm', async (req, res) => {
    const { email, code, password } = req.body

    if (!email || !code || !password) {
        return res.status(400).json({ error: 'Укажи email, код и новый пароль' })
    }

    if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'Код должен состоять из 6 цифр' })
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' })
    }

    const normalizedEmail = normalizeEmail(email)
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const resetResult = await client.query(
            `
                SELECT prc.id, prc.registration_id, prc.code_hash, prc.expires_at, prc.attempts, r.login
                FROM password_reset_codes prc
                INNER JOIN registration_data r ON r.id = prc.registration_id
                WHERE LOWER(prc.email) = $1 AND prc.used_at IS NULL
                ORDER BY prc.created_at DESC
                LIMIT 1
            `,
            [normalizedEmail]
        )

        if (resetResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(400).json({ error: 'Код не найден или уже использован' })
        }

        const reset = resetResult.rows[0]

        if (new Date(reset.expires_at).getTime() < Date.now()) {
            await client.query('UPDATE password_reset_codes SET used_at = CURRENT_DATE WHERE id = $1', [
                reset.id,
            ])
            await client.query('COMMIT')
            return res.status(400).json({ error: 'Код истек, запроси новый' })
        }

        if (reset.attempts >= 5) {
            await client.query('ROLLBACK')
            return res.status(429).json({ error: 'Слишком много попыток, запроси новый код' })
        }

        const incomingHash = hashPasswordResetCode(normalizedEmail, code)

        if (incomingHash !== reset.code_hash) {
            await client.query(
                'UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1',
                [reset.id]
            )
            await client.query('COMMIT')
            return res.status(400).json({ error: 'Неверный код' })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        await client.query('UPDATE registration_data SET password_hash = $1 WHERE id = $2', [
            passwordHash,
            reset.registration_id,
        ])
        await client.query('UPDATE password_reset_codes SET used_at = CURRENT_DATE WHERE id = $1', [
            reset.id,
        ])

        await createAuditLog(
            {
                actorType: 'user',
                actorId: reset.registration_id,
                actorLogin: reset.login,
                action: 'password_reset_completed',
                entityTable: 'registration_data',
                entityId: reset.registration_id,
                changes: {
                    password: {
                        from: 'old_password_hash',
                        to: 'new_password_hash',
                    },
                },
                ipAddress: req.ip,
            },
            client
        )

        await client.query('COMMIT')

        return res.json({ message: 'Пароль обновлен, теперь можно войти' })
    } catch (error) {
        await client.query('ROLLBACK')
        logError('Сброс пароля (подтверждение)', error.message || String(error))
        return res.status(500).json({ error: 'Не удалось обновить пароль' })
    } finally {
        client.release()
    }
})


app.post('/api/payments/fake/quick-pay', authenticateToken, async (req, res) => {
    const requestedAmount = normalizePaymentAmount(req.body.amount)

    if (!requestedAmount || requestedAmount <= 0) {
        return res.status(400).json({ error: 'Укажи сумму оплаты больше 0' })
    }

    if (requestedAmount > 10000) {
        return res.status(400).json({ error: 'Сумма одного платежа не должна превышать 10000' })
    }

    const client = await pool.connect()

    try {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await client.query('BEGIN')

        const payload = `fakepay_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
        const applyResult = await applyTelegramPaymentToAccount(client, req.user.id, requestedAmount)

        const result = await client.query(
            `
                INSERT INTO telegram_payment_orders (
                    registration_id,
                    amount,
                    currency,
                    payment_method,
                    invoice_currency,
                    invoice_amount,
                    status,
                    telegram_payload,
                    description,
                    paid_at,
                    telegram_payment_charge_id,
                    provider_payment_charge_id
                )
                VALUES ($1, $2, $3, 'telegram_provider', $3, $4, 'paid', $5, $6, CURRENT_DATE, $7, $7)
                RETURNING *
            `,
            [
                req.user.id,
                requestedAmount,
                TELEGRAM_PAYMENT_CURRENCY,
                Math.round(requestedAmount * 100),
                payload,
                req.body.description || 'Фиктивная оплата после подтверждения пользователем',
                `fake_${payload}`,
            ]
        )

        await createAuditLog(
            {
                actorType: 'user',
                actorId: req.user.id,
                actorLogin: req.user.login,
                action: 'fake_payment_paid',
                entityTable: 'telegram_payment_orders',
                entityId: result.rows[0].id,
                changes: {
                    after: {
                        amount: requestedAmount,
                        currency: TELEGRAM_PAYMENT_CURRENCY,
                        status: 'paid',
                        applied_to_debt: applyResult.appliedToDebt,
                    },
                },
                ipAddress: req.ip,
            },
            client
        )

        await client.query('COMMIT')

        return res.status(201).json({
            message: `Оплата подтверждена. Списано с активной задолженности: ${applyResult.appliedToDebt} ${TELEGRAM_PAYMENT_CURRENCY}`,
            order: serializePaymentOrder(result.rows[0]),
            appliedToDebt: applyResult.appliedToDebt,
        })
    } catch (error) {
        await client.query('ROLLBACK')
        logError('Фиктивная оплата', error.message || String(error))
        return res.status(500).json({ error: 'Не удалось выполнить фиктивную оплату' })
    } finally {
        client.release()
    }
})

app.post('/api/payments/telegram/orders', authenticateToken, async (req, res) => {
    try {
        const debtResult = await pool.query(
            `
                SELECT COALESCE(SUM(CASE WHEN is_active THEN debt_amount ELSE 0 END), 0)::text AS active_debt
                FROM debtors
                WHERE registration_id = $1
            `,
            [req.user.id]
        )
        const activeDebt = normalizePaymentAmount(debtResult.rows[0]?.active_debt || 0)
        const requestedAmount = req.body.amount === undefined || req.body.amount === ''
            ? activeDebt
            : normalizePaymentAmount(req.body.amount)

        if (!requestedAmount || requestedAmount <= 0) {
            return res.status(400).json({ error: 'Укажи сумму оплаты больше 0' })
        }

        if (requestedAmount > 10000) {
            return res.status(400).json({ error: 'Сумма одного платежа не должна превышать 10000' })
        }

        const payload = `barpay_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
        const description = req.body.description || 'Оплата услуг водоснабжения (горячая/холодная вода)'
        const paymentMethod = normalizeTelegramPaymentMode()
        const invoiceCurrency = getTelegramInvoiceCurrency()
        const invoiceAmount = calculateTelegramInvoiceAmount(requestedAmount)
        const result = await pool.query(
            `
                INSERT INTO telegram_payment_orders (
                    registration_id,
                    amount,
                    currency,
                    payment_method,
                    invoice_currency,
                    invoice_amount,
                    telegram_payload,
                    description
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `,
            [
                req.user.id,
                requestedAmount,
                TELEGRAM_PAYMENT_CURRENCY,
                paymentMethod,
                invoiceCurrency,
                invoiceAmount,
                payload,
                description,
            ]
        )
        const order = serializePaymentOrder(result.rows[0])

        await createAuditLog({
            actorType: 'user',
            actorId: req.user.id,
            actorLogin: req.user.login,
            action: 'telegram_payment_created',
            entityTable: 'telegram_payment_orders',
            entityId: order.id,
            changes: {
                after: {
                    amount: order.amount,
                    currency: order.currency,
                    paymentMethod: order.paymentMethod,
                    invoiceCurrency: order.invoiceCurrency,
                    invoiceAmount: order.invoiceAmount,
                    status: order.status,
                },
            },
            ipAddress: req.ip,
        })

        return res.status(201).json({
            order,
            botUrl: buildTelegramPaymentLink(payload),
            setupRequired: !isTelegramPaymentsConfigured(),
        })
    } catch (error) {
        logError('Платеж Telegram (создание)', error.message || String(error))
        return res.status(500).json({ error: 'Не удалось создать платеж Telegram' })
    }
})

app.get('/api/payments/telegram/orders/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
                SELECT *
                FROM telegram_payment_orders
                WHERE id = $1 AND registration_id = $2
            `,
            [req.params.id, req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Платеж не найден' })
        }

        return res.json({ order: serializePaymentOrder(result.rows[0]) })
    } catch (error) {
        logError('Платеж Telegram (статус)', error.message || String(error))
        return res.status(500).json({ error: 'Не удалось получить статус платежа' })
    }
})

app.post('/api/telegram/webhook/:secret', async (req, res) => {
    if (req.params.secret !== TELEGRAM_WEBHOOK_SECRET) {
        return res.status(403).json({ error: 'Неверный секрет webhook' })
    }

    const update = req.body

    try {
        if (update.pre_checkout_query) {
            const query = update.pre_checkout_query
            const orderResult = await pool.query(
                `
                    SELECT *
                    FROM telegram_payment_orders
                    WHERE telegram_payload = $1
                `,
                [query.invoice_payload]
            )
            const order = orderResult.rows[0]
            const orderIsValid =
                order &&
                order.status !== 'paid' &&
                order.invoice_currency === query.currency &&
                Number(order.invoice_amount) === query.total_amount

            await telegramBotApi('answerPreCheckoutQuery', {
                pre_checkout_query_id: query.id,
                ok: Boolean(orderIsValid),
                error_message: orderIsValid ? undefined : 'Платеж не найден или сумма не совпадает',
            })

            return res.json({ ok: true })
        }

        const message = update.message

        if (message?.successful_payment) {
            await markTelegramPaymentPaid(
                message.successful_payment.invoice_payload,
                message.successful_payment,
                update
            )

            return res.json({ ok: true })
        }

        const startMatch = message?.text?.match(/^\/start(?:@\w+)?\s+(.+)$/)

        if (startMatch) {
            const telegramPayload = startMatch[1].trim()
            const orderResult = await pool.query(
                `
                    SELECT *
                    FROM telegram_payment_orders
                    WHERE telegram_payload = $1
                `,
                [telegramPayload]
            )

            if (orderResult.rows.length === 0) {
                await sendTelegramMessage(message.chat.id, 'Платеж не найден. Создайте новый платеж в личном кабинете.')
                return res.json({ ok: true })
            }

            const order = orderResult.rows[0]

            if (order.status === 'paid') {
                await sendTelegramMessage(message.chat.id, 'Этот платеж уже оплачен.')
                return res.json({ ok: true })
            }

            if (!isTelegramPaymentsConfigured()) {
                await sendTelegramMessage(message.chat.id, 'Оплата временно недоступна: не настроены параметры Telegram-платежей.')
                return res.json({ ok: true })
            }

            await sendTelegramInvoice(message.chat.id, order)
            await pool.query(
                `
                    UPDATE telegram_payment_orders
                    SET status = 'invoice_sent',
                        telegram_chat_id = $1,
                        telegram_username = $2,
                        invoice_sent_at = CURRENT_DATE
                    WHERE id = $3
                `,
                [message.chat.id, message.from?.username || null, order.id]
            )

            return res.json({ ok: true })
        }

        return res.json({ ok: true })
    } catch (error) {
        logError('Telegram webhook', error.message || String(error))
        return res.status(500).json({ ok: false })
    }
})

app.post('/api/admin/login', async (req, res) => {
    const { login, password } = req.body

    if (!login || !password) {
        return res.status(400).json({ error: 'Нужны логин и пароль администратора' })
    }

    try {
        const result = await pool.query(
            `
                SELECT id, login, password_hash, role
                FROM admins
                WHERE login = $1 AND is_active = TRUE
            `,
            [login]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверные данные администратора' })
        }

        const admin = result.rows[0]
        const validPassword = await bcrypt.compare(password, admin.password_hash)

        if (!validPassword) {
            return res.status(401).json({ error: 'Неверные данные администратора' })
        }

        const token = jwt.sign(
            {
                id: admin.id,
                login: admin.login,
                role: admin.role,
            },
            ADMIN_JWT_SECRET,
            { expiresIn: '8h' }
        )

        return res.json({
            admin: {
                id: admin.id,
                login: admin.login,
                role: admin.role,
            },
            token,
        })
    } catch (error) {
        logError('Вход администратора', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка сервера при входе администратора' })
    }
})

app.get('/api/admin/logs', authenticateAdminToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    id,
                    actor_type,
                    actor_id,
                    actor_login,
                    action,
                    entity_table,
                    entity_id,
                    changes,
                    ip_address,
                    created_at
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT 100
            `
        )

        return res.json({ logs: result.rows })
    } catch (error) {
        logError('Чтение журнала действий', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка чтения журнала действий' })
    }
})

app.get('/api/admin/logs/stream', (req, res) => {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1] || req.query.token
    const admin = verifyAdminToken(token)

    if (!admin) {
        return res.status(401).json({ error: 'Токен администратора обязателен' })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    auditClients.add(res)
    res.write('event: connected\ndata: {}\n\n')

    const heartbeat = setInterval(() => {
        res.write(': ping\n\n')
    }, 25000)

    req.on('close', () => {
        clearInterval(heartbeat)
        auditClients.delete(res)
    })
})

app.get('/api/admin/tables', authenticateAdminToken, (req, res) => {
    const tables = Object.entries(adminTables).map(([name, config]) => ({
        name,
        title: config.title,
        columns: config.columns,
        editable: config.editable,
        createable: config.createable,
    }))

    return res.json({ tables })
})

app.get('/api/admin/tables/:tableName', authenticateAdminToken, async (req, res) => {
    const table = getAdminTable(req.params.tableName)

    if (!table) {
        return res.status(404).json({ error: 'Таблица не найдена' })
    }

    try {
        const result = await getAdminRows(pool, req.params.tableName, table)

        return res.json({
            table: {
                name: req.params.tableName,
                title: table.title,
                columns: table.columns,
                editable: table.editable,
                createable: table.createable,
            },
            rows: result.rows,
        })
    } catch (error) {
        logError('Чтение таблицы', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка чтения таблицы' })
    }
})

app.post('/api/admin/tables/:tableName', authenticateAdminToken, async (req, res) => {
    const table = getAdminTable(req.params.tableName)

    if (!table || table.createable.length === 0) {
        return res.status(400).json({ error: 'Добавление записей для этой таблицы недоступно' })
    }

    const validationError = validateAdminPayload(req.params.tableName, req.body, 'create')

    if (validationError) {
        return res.status(400).json({ error: validationError })
    }

    const columns = table.createable.filter((column) => Object.hasOwn(req.body, column))

    if (columns.length === 0) {
        return res.status(400).json({ error: 'Нет данных для добавления' })
    }

    const insertColumns = columns.filter((column) => column !== 'password')
    const tableColumns = getAdminTableColumns(table)
    const values = insertColumns.map((column) => normalizeAdminValue(req.body[column], column))

    if (req.params.tableName === 'registration_data') {
        insertColumns.push('password_hash')
        values.push(await bcrypt.hash(String(req.body.password), 10))
    }

    const placeholders = values.map((_, index) => `$${index + 1}`)

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const result = await client.query(
            `
                INSERT INTO ${req.params.tableName} (${insertColumns.join(', ')})
                VALUES (${placeholders.join(', ')})
                RETURNING ${tableColumns.join(', ')}
            `,
            values
        )
        let row = result.rows[0]

        if (req.params.tableName === 'registration_data') {
            await client.query(
                `
                    INSERT INTO personalization_data (registration_id, full_name, residential_address, registration_address)
                    VALUES ($1, $2, $3, $3)
                    ON CONFLICT (registration_id) DO NOTHING
                `,
                [row.id, row.fio, row.street]
            )

            for (const waterType of WATER_TYPES) {
                const tariff = await getActiveTariff(client, waterType)

                await client.query(
                    `
                        INSERT INTO water_meter_readings (registration_id, water_type, current_reading, unit)
                        VALUES ($1, $2, 0, $3)
                        ON CONFLICT (registration_id, water_type) DO NOTHING
                    `,
                    [row.id, waterType, waterType === 'hot_water' ? 'м3' : tariff.unit]
                )
            }
        }

        if (req.params.tableName === 'water_balances') {
            await syncNegativeBalanceDebt(client, row, {
                actorType: 'admin',
                actorId: req.admin.id,
                actorLogin: req.admin.login,
                ipAddress: req.ip,
            })
        }

        const createdRowResult = await getAdminRow(client, req.params.tableName, table, row.id)
        row = createdRowResult.rows[0] || row

        await createAuditLog(
            {
                actorType: 'admin',
                actorId: req.admin.id,
                actorLogin: req.admin.login,
                action: 'admin_create',
                entityTable: req.params.tableName,
                entityId: row.id,
                changes: {
                    after: row,
                },
                ipAddress: req.ip,
            },
            client
        )

        await client.query('COMMIT')

        return res.status(201).json({ row })
    } catch (error) {
        await client.query('ROLLBACK')
        logError('Добавление записи', error.message || String(error))
        return res.status(500).json({ error: getDatabaseErrorMessage(error, 'добавления') })
    } finally {
        client.release()
    }
})

app.put('/api/admin/tables/:tableName/:id', authenticateAdminToken, async (req, res) => {
    const table = getAdminTable(req.params.tableName)

    if (!table || table.editable.length === 0) {
        return res.status(400).json({ error: 'Редактирование этой таблицы недоступно' })
    }

    const validationError = validateAdminPayload(req.params.tableName, req.body, 'edit')

    if (validationError) {
        return res.status(400).json({ error: validationError })
    }

    const columns = table.editable.filter((column) => Object.hasOwn(req.body, column))

    if (columns.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' })
    }

    const values = columns.map((column) => normalizeAdminValue(req.body[column], column))
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`)
    const tableColumns = getAdminTableColumns(table)

    if (table.columns.includes('updated_at')) {
        assignments.push('updated_at = CURRENT_DATE')
    }

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const beforeResult = await getAdminRow(client, req.params.tableName, table, req.params.id)

        if (beforeResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Запись не найдена' })
        }

        const result = await client.query(
            `
                UPDATE ${req.params.tableName}
                SET ${assignments.join(', ')}
                WHERE id = $${values.length + 1}
                RETURNING ${tableColumns.join(', ')}
            `,
            [...values, req.params.id]
        )
        let row = result.rows[0]

        if (req.params.tableName === 'registration_data') {
            await client.query(
                `
                    INSERT INTO personalization_data (registration_id, full_name, residential_address, registration_address)
                    VALUES ($1, $2, $3, $3)
                    ON CONFLICT (registration_id) DO NOTHING
                `,
                [row.id, row.fio, row.street]
            )

            for (const waterType of WATER_TYPES) {
                const tariff = await getActiveTariff(client, waterType)

                await client.query(
                    `
                        INSERT INTO water_meter_readings (registration_id, water_type, current_reading, unit)
                        VALUES ($1, $2, 0, $3)
                        ON CONFLICT (registration_id, water_type) DO NOTHING
                    `,
                    [row.id, waterType, waterType === 'hot_water' ? 'м3' : tariff.unit]
                )
            }
        }

        if (req.params.tableName === 'water_balances') {
            await syncNegativeBalanceDebt(client, row, {
                actorType: 'admin',
                actorId: req.admin.id,
                actorLogin: req.admin.login,
                ipAddress: req.ip,
            })
        }

        const updatedRowResult = await getAdminRow(client, req.params.tableName, table, row.id)
        row = updatedRowResult.rows[0] || row

        const changes = buildAuditChanges(beforeResult.rows[0], row, table.editable)

        if (Object.keys(changes).length > 0) {
            await createAuditLog(
                {
                    actorType: 'admin',
                    actorId: req.admin.id,
                    actorLogin: req.admin.login,
                    action: 'admin_update',
                    entityTable: req.params.tableName,
                    entityId: row.id,
                    changes,
                    ipAddress: req.ip,
                },
                client
            )
        }

        await client.query('COMMIT')

        return res.json({ row })
    } catch (error) {
        await client.query('ROLLBACK')
        logError('Обновление записи', error.message || String(error))
        return res.status(500).json({ error: getDatabaseErrorMessage(error, 'обновления') })
    } finally {
        client.release()
    }
})

app.delete('/api/admin/tables/:tableName/:id', authenticateAdminToken, async (req, res) => {
    const table = getAdminTable(req.params.tableName)

    if (!table) {
        return res.status(404).json({ error: 'Таблица не найдена' })
    }

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const beforeResult = await getAdminRow(client, req.params.tableName, table, req.params.id)

        if (beforeResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Запись не найдена' })
        }

        await client.query(`DELETE FROM ${req.params.tableName} WHERE id = $1`, [req.params.id])

        if (req.params.tableName === 'water_balances') {
            await syncNegativeBalanceDebt(
                client,
                {
                    registration_id: beforeResult.rows[0].registration_id,
                    amount: 0,
                },
                {
                    actorType: 'admin',
                    actorId: req.admin.id,
                    actorLogin: req.admin.login,
                    ipAddress: req.ip,
                }
            )
        }

        await createAuditLog(
            {
                actorType: 'admin',
                actorId: req.admin.id,
                actorLogin: req.admin.login,
                action: 'admin_delete',
                entityTable: req.params.tableName,
                entityId: req.params.id,
                changes: {
                    before: beforeResult.rows[0],
                },
                ipAddress: req.ip,
            },
            client
        )

        await client.query('COMMIT')

        return res.json({ message: 'Запись удалена' })
    } catch (error) {
        await client.query('ROLLBACK')
        logError('Удаление записи', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка удаления записи' })
    } finally {
        client.release()
    }
})

app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    r.id,
                    r.login,
                    r.fio,
                    r.street,
                    p.full_name,
                    p.birth_date,
                    p.phone,
                    p.email,
                    p.residential_address,
                    p.registration_address,
                    COALESCE(hmr.current_reading, 0)::text AS hot_water,
                    COALESCE(hmr.current_reading, 0)::text AS hot_water_previous_reading,
                    COALESCE(hmr.unit, 'м3') AS hot_water_unit,
                    $2 AS hot_water_currency,
                    COALESCE(cmr.current_reading, 0)::text AS cold_water,
                    COALESCE(cmr.current_reading, 0)::text AS cold_water_previous_reading,
                    COALESCE(cmr.unit, 'м3') AS cold_water_unit,
                    $2 AS cold_water_currency,
                    COALESCE(hd.hot_debt, 0)::text AS hot_water_debt,
                    COALESCE(cd.cold_debt, 0)::text AS cold_water_debt,
                    COALESCE(d.active_debt, 0)::text AS amount_to_pay,
                    COALESCE(d.active_debt, 0)::text AS active_debt
                FROM registration_data r
                LEFT JOIN personalization_data p ON p.registration_id = r.id
                LEFT JOIN water_meter_readings hmr ON hmr.registration_id = r.id AND hmr.water_type = 'hot_water'
                LEFT JOIN water_meter_readings cmr ON cmr.registration_id = r.id AND cmr.water_type = 'cold_water'
                LEFT JOIN LATERAL (
                    SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS hot_debt
                    FROM debtors
                    WHERE registration_id = r.id
                      AND reason LIKE 'Начисление по показаниям счетчика: Горячая вода%'
                ) hd ON TRUE
                LEFT JOIN LATERAL (
                    SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS cold_debt
                    FROM debtors
                    WHERE registration_id = r.id
                      AND reason LIKE 'Начисление по показаниям счетчика: Холодная вода%'
                ) cd ON TRUE
                LEFT JOIN LATERAL (
                    SELECT COALESCE(SUM(debt_amount) FILTER (WHERE is_active), 0) AS active_debt
                    FROM debtors
                    WHERE registration_id = r.id
                ) d ON TRUE
                WHERE r.id = $1
            `,
            [req.user.id, TELEGRAM_PAYMENT_CURRENCY]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' })
        }

        const row = result.rows[0]

        return res.json({
            id: row.id,
            login: row.login,
            fio: row.fio,
            street: row.street,
            fullName: row.full_name || row.fio || '',
            birthDate: row.birth_date || '',
            phone: row.phone || '',
            email: row.email || '',
            residentialAddress: row.residential_address || '',
            registrationAddress: row.registration_address || row.street || '',
            hotWater: Number(row.hot_water),
            coldWater: Number(row.cold_water),
            hotWaterPreviousReading: Number(row.hot_water_previous_reading),
            coldWaterPreviousReading: Number(row.cold_water_previous_reading),
            hotWaterUnit: row.hot_water_unit || 'м3',
            coldWaterUnit: row.cold_water_unit || 'м3',
            hotWaterDebt: Number(row.hot_water_debt),
            coldWaterDebt: Number(row.cold_water_debt),
            amountToPay: Number(row.amount_to_pay),
            currency: row.hot_water_currency || TELEGRAM_PAYMENT_CURRENCY,
            activeDebt: Number(row.active_debt),
        })
    } catch (error) {
        logError('Профиль (чтение)', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка сервера' })
    }
})

app.put('/api/profile', authenticateToken, async (req, res) => {
    const {
        fullName,
        birthDate,
        phone,
        email,
        residentialAddress,
        registrationAddress,
    } = req.body

    const requiredError = validateRequiredFields(
        {
            fullName,
            birthDate,
            phone,
            email,
            residentialAddress,
            registrationAddress,
        },
        [
            { key: 'fullName', label: 'ФИО' },
            { key: 'birthDate', label: 'Дата рождения' },
            { key: 'phone', label: 'Телефон' },
            { key: 'email', label: 'Email' },
            { key: 'residentialAddress', label: 'Адрес проживания' },
            { key: 'registrationAddress', label: 'Адрес регистрации' },
        ]
    )

    if (requiredError) {
        return res.status(400).json({ error: requiredError })
    }

    const contactError = validateContactFields({
        birthDate,
        phone,
        email,
    })

    if (contactError) {
        return res.status(400).json({ error: contactError })
    }

    const normalizedBirthDate = birthDate ? parseRuDateToIso(birthDate) : ''

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const beforeResult = await client.query(
            `
                SELECT
                    id,
                    registration_id,
                    full_name,
                    birth_date,
                    phone,
                    email,
                    residential_address,
                    registration_address
                FROM personalization_data
                WHERE registration_id = $1
            `,
            [req.user.id]
        )

        if (beforeResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Профиль не найден' })
        }

        const result = await client.query(
            `
                UPDATE personalization_data
                SET
                    full_name = $1,
                    birth_date = NULLIF($2, '')::date,
                    phone = $3,
                    email = $4,
                    residential_address = $5,
                    registration_address = $6,
                    updated_at = CURRENT_DATE
                WHERE registration_id = $7
                RETURNING
                    id,
                    registration_id,
                    full_name,
                    birth_date,
                    phone,
                    email,
                    residential_address,
                    registration_address
            `,
            [
                fullName || null,
                normalizedBirthDate || '',
                phone || null,
                email || null,
                residentialAddress || null,
                registrationAddress || null,
                req.user.id,
            ]
        )

        const changes = buildAuditChanges(beforeResult.rows[0], result.rows[0], [
            'full_name',
            'birth_date',
            'phone',
            'email',
            'residential_address',
            'registration_address',
        ])

        if (Object.keys(changes).length > 0) {
            await createAuditLog(
                {
                    actorType: 'user',
                    actorId: req.user.id,
                    actorLogin: req.user.login,
                    action: 'profile_update',
                    entityTable: 'personalization_data',
                    entityId: result.rows[0].id,
                    changes,
                    ipAddress: req.ip,
                },
                client
            )
        }

        await client.query('COMMIT')

        return res.json({ message: 'Профиль обновлен' })
    } catch (error) {
        await client.query('ROLLBACK')
        logError('Профиль (обновление)', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' })
    } finally {
        client.release()
    }
})

app.get('/api/tariffs', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
                SELECT id, water_type, CASE water_type WHEN 'hot_water' THEN 'Горячая вода' WHEN 'cold_water' THEN 'Холодная вода' ELSE water_type END AS water_type_label, rate_per_unit::text AS rate_per_unit, unit, currency, effective_from, is_active
                FROM tariffs
                WHERE is_active = TRUE
                ORDER BY water_type, effective_from DESC
            `
        )
        return res.json({ tariffs: result.rows })
    } catch (error) {
        logError('Тарифы (чтение)', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка чтения тарифов' })
    }
})

app.get('/api/payments/history', authenticateToken, async (req, res) => {
    try {
        const telegramResult = await pool.query(
            `
                SELECT
                    id,
                    'telegram' AS payment_type,
                    amount::text AS amount,
                    currency,
                    status,
                    description,
                    created_at,
                    paid_at
                FROM telegram_payment_orders
                WHERE registration_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT 50
            `,
            [req.user.id]
        )

        const fakeResult = await pool.query(
            `
                SELECT
                    id,
                    'fake' AS payment_type,
                    amount::text AS amount,
                    currency,
                    status,
                    description,
                    water_type,
                    previous_reading::text AS previous_reading,
                    current_reading::text AS current_reading,
                    consumption::text AS consumption,
                    tariff_rate::text AS tariff_rate,
                    CASE water_type WHEN 'hot_water' THEN 'м3' ELSE unit END AS unit,
                    created_at,
                    NULL::timestamp AS paid_at
                FROM fake_payments
                WHERE registration_id = $1
                ORDER BY created_at DESC, id DESC
                LIMIT 50
            `,
            [req.user.id]
        )

        const history = [...telegramResult.rows, ...fakeResult.rows]
            .sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
                if (dateA !== dateB) return dateB - dateA
                return (Number(b.id) || 0) - (Number(a.id) || 0)
            })
            .slice(0, 50)

        return res.json({ history })
    } catch (error) {
        logError('История платежей', error.message || String(error))
        return res.status(500).json({ error: 'Ошибка чтения истории платежей' })
    }
})

app.post('/api/payments/fake', authenticateToken, async (req, res) => {
    const { hotWaterReading, coldWaterReading, description } = req.body

    const submittedReadings = [
        { waterType: 'hot_water', reading: normalizeMeterReading(hotWaterReading) },
        { waterType: 'cold_water', reading: normalizeMeterReading(coldWaterReading) },
    ].filter((item) => item.reading !== null)

    if (submittedReadings.length === 0) {
        return res.status(400).json({ error: 'Укажите новые показания горячей или холодной воды' })
    }

    for (const item of submittedReadings) {
        if (item.reading < 0) {
            return res.status(400).json({ error: 'Показания счетчика не могут быть отрицательными' })
        }
    }

    try {
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            const createdPayments = []
            let totalAmount = 0

            for (const item of submittedReadings) {
                const waterLabel = WATER_TYPE_LABELS[item.waterType] || item.waterType
                const previousResult = await client.query(
                    `
                        SELECT current_reading::text AS current_reading, unit
                        FROM water_meter_readings
                        WHERE registration_id = $1 AND water_type = $2
                    `,
                    [req.user.id, item.waterType]
                )

                const tariff = await getActiveTariff(client, item.waterType)
                const coldTariff = item.waterType === 'hot_water'
                    ? await getActiveTariff(client, 'cold_water')
                    : null
                const previousReading = normalizeMeterReading(previousResult.rows[0]?.current_reading || 0) || 0
                const currentReading = item.reading

                if (currentReading < previousReading) {
                    await client.query('ROLLBACK')
                    return res.status(400).json({
                        error: `${waterLabel}: новые показания не могут быть меньше старых (${previousReading})`,
                    })
                }

                const consumption = normalizeMeterReading(currentReading - previousReading) || 0
                const coldWaterPart = item.waterType === 'hot_water'
                    ? normalizePaymentAmount(consumption * (coldTariff?.rate || 0))
                    : 0
                const heatingPart = item.waterType === 'hot_water'
                    ? normalizePaymentAmount(consumption * tariff.rate)
                    : 0
                const effectiveTariffRate = item.waterType === 'hot_water'
                    ? normalizePaymentAmount((coldTariff?.rate || 0) + tariff.rate)
                    : tariff.rate
                const paymentAmount = item.waterType === 'hot_water'
                    ? normalizePaymentAmount(coldWaterPart + heatingPart)
                    : normalizePaymentAmount(consumption * effectiveTariffRate) || 0
                totalAmount = normalizePaymentAmount(totalAmount + paymentAmount)

                const result = await client.query(
                    `
                        INSERT INTO fake_payments (
                            registration_id,
                            amount,
                            currency,
                            water_type,
                            description,
                            status,
                            previous_reading,
                            current_reading,
                            consumption,
                            tariff_rate,
                            unit
                        )
                        VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10)
                        RETURNING *
                    `,
                    [
                        req.user.id,
                        paymentAmount,
                        tariff.currency,
                        item.waterType,
                        description || `Расчет по показаниям счетчика: ${waterLabel}`,
                        previousReading,
                        currentReading,
                        consumption,
                        effectiveTariffRate,
                        item.waterType === 'hot_water' ? 'м3' : tariff.unit,
                    ]
                )

                await client.query(
                    `
                        INSERT INTO water_meter_readings (registration_id, water_type, current_reading, unit)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (registration_id, water_type) DO UPDATE
                        SET current_reading = EXCLUDED.current_reading,
                            unit = EXCLUDED.unit,
                            updated_at = CURRENT_DATE
                    `,
                    [req.user.id, item.waterType, currentReading, item.waterType === 'hot_water' ? 'м3' : tariff.unit]
                )

                let debtId = null
                if (paymentAmount > 0) {
                    const debtReason = `${METER_READING_DEBT_REASON_PREFIX}: ${waterLabel}`
                    const debtResult = await client.query(
                        `
                            INSERT INTO debtors (registration_id, debt_amount, reason, is_active)
                            VALUES ($1, $2, $3, TRUE)
                            RETURNING id
                        `,
                        [req.user.id, paymentAmount, debtReason]
                    )
                    debtId = debtResult.rows[0].id
                }

                await createAuditLog(
                    {
                        actorType: 'user',
                        actorId: req.user.id,
                        actorLogin: req.user.login,
                        action: 'meter_reading_payment_created',
                        entityTable: 'fake_payments',
                        entityId: result.rows[0].id,
                        changes: {
                            after: {
                                water_type: item.waterType,
                                previous_reading: previousReading,
                                current_reading: currentReading,
                                consumption,
                                tariff_rate: effectiveTariffRate,
                                unit: item.waterType === 'hot_water' ? 'м3' : tariff.unit,
                                amount: paymentAmount,
                                currency: tariff.currency,
                                status: 'completed',
                                debt_id: debtId,
                            },
                        },
                        ipAddress: req.ip,
                    },
                    client
                )

                createdPayments.push(result.rows[0])
            }

            await client.query('COMMIT')

            return res.status(201).json({
                message: `Показания счетчиков сохранены. Предыдущие показания обновлены, начислено к оплате: ${totalAmount} ${TELEGRAM_PAYMENT_CURRENCY}`,
                totalAmount,
                payments: createdPayments,
            })
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    } catch (error) {
        logError('Расчет по показаниям счетчиков', error.message || String(error))
        return res.status(500).json({ error: 'Не удалось сохранить показания счетчиков' })
    }
})

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            logInfo('Сервер', `Сервер запущен на порту ${PORT}`)
        })
    })
    .catch((error) => {
        logError('Инициализация БД', error.message || String(error))
        process.exit(1)
    })
