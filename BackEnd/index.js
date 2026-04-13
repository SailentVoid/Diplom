require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
const app = express()
app.use(express.json())
const jwt=require('jsonwebtoken')

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
})



const JWT_SECRET = process.env.DB_SECRET = 'supersecretkey123'
app.use(cors('http://localhost:5173/'))
const PORT = 3000


const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]

    if (!token) {
        return res.status(401).json({ error: 'Токен обязателен' })
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' })
        }

        req.user = user
        next()
    })
}


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})


app.post('/api/auth/register', async (req, res) => {
    const { fio, login, street, password } = req.body

    if (!fio || !password || !login || !street) {
        return res.status(400).json({ error: 'Заполни все поля' })
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10)
        const result = await pool.query(
            'INSERT INTO users (fio, login, street, password) VALUES ($1, $2, $3, $4) RETURNING id, fio, login, street',
            [fio, login, street, hashedPassword]
        )

        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error('ОШИБКА:', error)
        res.status(500).json({ error: error.message })
    }
})


app.post('/api/auth/login', async (req, res) => {
    const { login, password, fio } = req.body

    try {
        const result = await pool.query(
            'SELECT id, login, password, fio FROM users WHERE login = $1',
            [login]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверные данные' })
        }

        const user = result.rows[0]
        const valid = await bcrypt.compare(password, user.password)

        if (!valid) {
            return res.status(401).json({ error: 'Неверные данные' })
        }

        const token = jwt.sign(
            {
                id: user.id,
                Login: user.login,
                fio: user.fio
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        )

        res.json({
            user: {
                id: user.id,
                login: user.login,
                fio: user.fio
            },
            token
        })
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).json({ error: 'Ошибка сервера' })
    }
})

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, fio FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json(result.rows[0]); // { id: 1, fio: "Иван Иванов" }
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});