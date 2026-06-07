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

const adminTables = {
    registration_data: {
        title: 'Данные регистрации',
        columns: ['id', 'fio', 'login', 'street', 'balance', 'active_debt', 'debtor_status', 'created_at'],
        persistedColumns: ['id', 'fio', 'login', 'street', 'created_at'],
        editable: ['fio', 'login', 'street'],
        createable: [],
        selectSql: `
            SELECT
                r.id,
                r.fio,
                r.login,
                r.street,
                COALESCE(b.amount, 0)::text AS balance,
                COALESCE(d.active_debt, 0)::text AS active_debt,
                CASE
                    WHEN COALESCE(b.amount, 0) < 0 OR COALESCE(d.active_debt, 0) > 0
                        THEN 'Должник'
                    ELSE 'Нет долга'
                END AS debtor_status,
                r.created_at
            FROM registration_data r
            LEFT JOIN balances b ON b.registration_id = r.id
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
                COALESCE(b.amount, 0)::text AS balance,
                COALESCE(d.active_debt, 0)::text AS active_debt,
                CASE
                    WHEN COALESCE(b.amount, 0) < 0 OR COALESCE(d.active_debt, 0) > 0
                        THEN 'Должник'
                    ELSE 'Нет долга'
                END AS debtor_status,
                r.created_at
            FROM registration_data r
            LEFT JOIN balances b ON b.registration_id = r.id
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
            'registration_id',
            'full_name',
            'birth_date',
            'phone',
            'email',
            'residential_address',
            'registration_address',
            'created_at',
            'updated_at',
        ],
        editable: [
            'registration_id',
            'full_name',
            'birth_date',
            'phone',
            'email',
            'residential_address',
            'registration_address',
        ],
        createable: [
            'registration_id',
            'full_name',
            'birth_date',
            'phone',
            'email',
            'residential_address',
            'registration_address',
        ],
    },
    admins: {
        title: 'Админы',
        columns: ['id', 'registration_id', 'login', 'role', 'is_active', 'created_at'],
        editable: ['registration_id', 'login', 'role', 'is_active'],
        createable: [],
    },
    balances: {
        title: 'Баланс',
        columns: ['id', 'registration_id', 'login', 'amount', 'currency', 'debtor_status', 'updated_at'],
        persistedColumns: ['id', 'registration_id', 'amount', 'currency', 'updated_at'],
        editable: ['registration_id', 'amount', 'currency'],
        createable: ['registration_id', 'amount', 'currency'],
        selectSql: `
            SELECT
                b.id,
                b.registration_id,
                r.login,
                b.amount::text AS amount,
                b.currency,
                CASE WHEN b.amount < 0 THEN 'Должник' ELSE 'Нет долга' END AS debtor_status,
                b.updated_at
            FROM balances b
            LEFT JOIN registration_data r ON r.id = b.registration_id
            ORDER BY b.id ASC
        `,
        selectByIdSql: `
            SELECT
                b.id,
                b.registration_id,
                r.login,
                b.amount::text AS amount,
                b.currency,
                CASE WHEN b.amount < 0 THEN 'Должник' ELSE 'Нет долга' END AS debtor_status,
                b.updated_at
            FROM balances b
            LEFT JOIN registration_data r ON r.id = b.registration_id
            WHERE b.id = $1
        `,
    },
    debtors: {
        title: 'Должники',
        columns: [
            'id',
            'registration_id',
            'debt_amount',
            'reason',
            'is_active',
            'created_at',
            'closed_at',
        ],
        editable: ['registration_id', 'debt_amount', 'reason', 'is_active', 'closed_at'],
        createable: ['registration_id', 'debt_amount', 'reason', 'is_active', 'closed_at'],
    },
    telegram_payment_orders: {
        title: 'Платежи Telegram',
        columns: [
            'id',
            'registration_id',
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
        editable: ['status', 'description'],
        createable: [],
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

const normalizeAdminValue = (value) => {
    if (value === '') {
        return null
    }

    return value
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
        console.log(`Password reset code for ${email}: ${code}`)
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

const syncNegativeBalanceDebt = async (
    client,
    balanceRow,
    { actorType = 'system', actorId = null, actorLogin = 'system', ipAddress = null } = {}
) => {
    const registrationId = balanceRow?.registration_id
    const balanceAmount = normalizePaymentAmount(balanceRow?.amount || 0)

    if (!registrationId || balanceAmount === null) {
        return null
    }

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
        [registrationId, AUTO_DEBT_REASON]
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
                            closed_at = NOW()
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
                            reason: AUTO_DEBT_REASON,
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
            [registrationId, debtAmount, AUTO_DEBT_REASON]
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
                        reason: AUTO_DEBT_REASON,
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
                closed_at = NOW()
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
                    reason: AUTO_DEBT_REASON,
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
        title: 'Оплата услуг водоканала',
        description: order.description || 'Оплата задолженности или пополнение баланса',
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

        if (debt.reason === AUTO_DEBT_REASON) {
            await client.query(
                `
                    INSERT INTO balances (registration_id, amount, currency)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (registration_id) DO UPDATE
                    SET amount = balances.amount + EXCLUDED.amount,
                        currency = EXCLUDED.currency,
                        updated_at = NOW()
                `,
                [registrationId, paidPart, TELEGRAM_PAYMENT_CURRENCY]
            )
        }

        if (newDebtAmount <= 0) {
            await client.query(
                `
                    UPDATE debtors
                    SET debt_amount = 0, is_active = FALSE, closed_at = NOW()
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
        await client.query(
            `
                INSERT INTO balances (registration_id, amount, currency)
                VALUES ($1, $2, $3)
                ON CONFLICT (registration_id) DO UPDATE
                SET amount = balances.amount + EXCLUDED.amount,
                    currency = EXCLUDED.currency,
                    updated_at = NOW()
            `,
            [registrationId, remaining, TELEGRAM_PAYMENT_CURRENCY]
        )
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
                    paid_at = NOW()
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
                SELECT id, registration_id, amount::text AS amount
                FROM balances
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
        INSERT INTO balances (registration_id, amount)
        SELECT r.id, 0
        FROM registration_data r
        LEFT JOIN balances b ON b.registration_id = r.id
        WHERE b.id IS NULL
    `)
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
    await seedAdmin()
    await migrateLegacyUsers()
    await syncExistingBalanceDebts()
    console.log('Database schema initialized')
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
    const { fio, login, street, password } = req.body

    if (!fio || !password || !login || !street) {
        return res.status(400).json({ error: 'Заполни все поля' })
    }

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const hashedPassword = await bcrypt.hash(password, 10)
        const registrationResult = await client.query(
            `
                INSERT INTO registration_data (fio, login, street, password_hash)
                VALUES ($1, $2, $3, $4)
                RETURNING id, fio, login, street
            `,
            [fio, login, street, hashedPassword]
        )

        const user = registrationResult.rows[0]

        await client.query(
            `
                INSERT INTO personalization_data (registration_id, full_name, residential_address, registration_address)
                VALUES ($1, $2, $3, $4)
            `,
            [user.id, fio, street, street]
        )

        await client.query(
            `
                INSERT INTO balances (registration_id, amount)
                VALUES ($1, 0)
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

        console.error('Registration error:', error)
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
        console.error('Login error:', error)
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
                    SET used_at = NOW()
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
        console.error('Password reset request error:', error)
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
            await client.query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = $1', [
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
        await client.query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = $1', [
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
        console.error('Password reset confirm error:', error)
        return res.status(500).json({ error: 'Не удалось обновить пароль' })
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
        const description = req.body.description || 'Оплата услуг водоснабжения и водоотведения'
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
        console.error('Telegram payment order create error:', error)
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
        console.error('Telegram payment order status error:', error)
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
                        invoice_sent_at = NOW()
                    WHERE id = $3
                `,
                [message.chat.id, message.from?.username || null, order.id]
            )

            return res.json({ ok: true })
        }

        return res.json({ ok: true })
    } catch (error) {
        console.error('Telegram webhook error:', error)
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
        console.error('Admin login error:', error)
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
        console.error('Audit logs read error:', error)
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
        console.error('Admin table read error:', error)
        return res.status(500).json({ error: 'Ошибка чтения таблицы' })
    }
})

app.post('/api/admin/tables/:tableName', authenticateAdminToken, async (req, res) => {
    const table = getAdminTable(req.params.tableName)

    if (!table || table.createable.length === 0) {
        return res.status(400).json({ error: 'Добавление записей для этой таблицы недоступно' })
    }

    const columns = table.createable.filter((column) => Object.hasOwn(req.body, column))

    if (columns.length === 0) {
        return res.status(400).json({ error: 'Нет данных для добавления' })
    }

    const tableColumns = getAdminTableColumns(table)
    const values = columns.map((column) => normalizeAdminValue(req.body[column]))
    const placeholders = columns.map((_, index) => `$${index + 1}`)

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const result = await client.query(
            `
                INSERT INTO ${req.params.tableName} (${columns.join(', ')})
                VALUES (${placeholders.join(', ')})
                RETURNING ${tableColumns.join(', ')}
            `,
            values
        )
        let row = result.rows[0]

        if (req.params.tableName === 'balances') {
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
        console.error('Admin table create error:', error)
        return res.status(500).json({ error: 'Ошибка добавления записи' })
    } finally {
        client.release()
    }
})

app.put('/api/admin/tables/:tableName/:id', authenticateAdminToken, async (req, res) => {
    const table = getAdminTable(req.params.tableName)

    if (!table || table.editable.length === 0) {
        return res.status(400).json({ error: 'Редактирование этой таблицы недоступно' })
    }

    const columns = table.editable.filter((column) => Object.hasOwn(req.body, column))

    if (columns.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' })
    }

    const values = columns.map((column) => normalizeAdminValue(req.body[column]))
    const assignments = columns.map((column, index) => `${column} = $${index + 1}`)
    const tableColumns = getAdminTableColumns(table)

    if (table.columns.includes('updated_at')) {
        assignments.push('updated_at = NOW()')
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

        if (req.params.tableName === 'balances') {
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
        console.error('Admin table update error:', error)
        return res.status(500).json({ error: 'Ошибка обновления записи' })
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

        if (req.params.tableName === 'balances') {
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
        console.error('Admin table delete error:', error)
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
                    COALESCE(b.amount, 0)::text AS balance,
                    COALESCE(b.currency, $2) AS currency,
                    COALESCE(SUM(CASE WHEN d.is_active THEN d.debt_amount ELSE 0 END), 0)::text AS active_debt
                FROM registration_data r
                LEFT JOIN personalization_data p ON p.registration_id = r.id
                LEFT JOIN balances b ON b.registration_id = r.id
                LEFT JOIN debtors d ON d.registration_id = r.id
                WHERE r.id = $1
                GROUP BY r.id, p.id, b.id, b.currency
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
            balance: Number(row.balance),
            currency: row.currency,
            activeDebt: Number(row.active_debt),
        })
    } catch (error) {
        console.error('Profile error:', error)
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
                    updated_at = NOW()
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
                birthDate || '',
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
        console.error('Profile update error:', error)
        return res.status(500).json({ error: 'Ошибка сервера при обновлении профиля' })
    } finally {
        client.release()
    }
})

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })
    })
    .catch((error) => {
        console.error('Database initialization failed:', error)
        process.exit(1)
    })
