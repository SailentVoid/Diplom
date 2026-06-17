# Личный кабинет абонента Барановичиводоканала

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)

Веб-приложение для личного кабинета абонента филиала "Барановичиводоканал" ГП "Брестводоканал". Проект объединяет удобный пользовательский сайт, защищенный backend API и PostgreSQL-базу данных для учета абонентов, показаний счетчиков, задолженностей, тарифов и платежей.

Сайт помогает пользователю видеть актуальные данные по горячей и холодной воде, передавать показания счетчиков, рассчитывать начисления, просматривать историю оплат и обновлять персональные данные. Для администратора предусмотрена отдельная панель управления с таблицами, аудитом действий и контролем платежной информации.

## Содержание

- [Возможности](#возможности)
- [Технологии](#технологии)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [API endpoints](#api-endpoints)
- [Структура проекта](#структура-проекта)
- [База данных](#база-данных)
- [Основные сценарии](#основные-сценарии)
- [Проверка проекта](#проверка-проекта)

## Возможности

- **Регистрация и вход**: создание учетной записи, авторизация по логину и паролю, хранение паролей в виде bcrypt-хэшей.
- **JWT-защита**: доступ к личному кабинету и API выполняется через Bearer token.
- **Восстановление пароля**: отправка 6-значного кода на email, проверка срока действия и количества попыток.
- **Профиль абонента**: ФИО, дата рождения, телефон, email, адрес проживания и адрес регистрации.
- **Показания счетчиков**: отдельный учет горячей и холодной воды, сохранение последних показаний и расчет расхода.
- **Расчет начислений**: применение тарифов к расходу воды, создание задолженности после передачи новых показаний.
- **История платежей**: единая таблица с Telegram-платежами и тестовыми платежами.
- **Фиктивная оплата**: учебный сценарий подтверждения платежа без реального платежного провайдера.
- **Telegram Payments**: создание платежного заказа, deep-link в бота, webhook для подтверждения оплаты.
- **Админ-панель**: просмотр и редактирование пользователей, персональных данных, счетчиков, задолженностей, тарифов и платежей.
- **Аудит действий**: журнал регистрации, изменений профиля, админских операций, платежей и восстановления пароля.
- **Документация к диплому**: UML/ER-диаграммы, пояснительные материалы и скрипты генерации документов.

## Технологии

| Часть | Стек |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Axios, SCSS Modules |
| Backend | Node.js, Express 5, PostgreSQL, pg, bcryptjs, jsonwebtoken |
| Интеграции | Nodemailer, Telegram Bot API, Telegram Payments |
| База данных | PostgreSQL, SQL-схема, миграционный SQL-скрипт |
| Документация | Mermaid diagrams, DOCX-материалы, Python-генератор дипломной документации |

## Быстрый старт

### Требования

- Node.js 20 или новее
- npm
- PostgreSQL
- Git

### 1. Клонирование репозитория

```bash
git clone https://github.com/SailentVoid/Diplom.git
cd Diplom
```

### 2. Подготовка базы данных

Создайте базу данных PostgreSQL:

```bash
createdb diplom
```

Если команда `createdb` недоступна, базу можно создать через pgAdmin или `psql`:

```sql
CREATE DATABASE diplom;
```

Backend автоматически читает `BackEnd/db/schema.sql` при запуске и создает необходимые таблицы. Если рядом есть `BackEnd/db/migrate_v2.sql`, он также применяется при инициализации.

### 3. Настройка backend

```bash
cd BackEnd
cp .env.example .env
npm install
npm start
```

Backend будет доступен по адресу:

```text
http://localhost:3000
```

### 4. Настройка frontend

Откройте второй терминал:

```bash
cd FrontEnd
npm install
npm run dev
```

Frontend будет доступен по адресу:

```text
http://localhost:5173
```

## Переменные окружения

Основной файл настроек находится здесь:

```text
BackEnd/.env
```

| Переменная | Назначение |
| --- | --- |
| `DB_USER` | Пользователь PostgreSQL |
| `DB_HOST` | Хост базы данных |
| `DB_NAME` | Название базы данных |
| `DB_PASSWORD` | Пароль PostgreSQL |
| `DB_PORT` | Порт PostgreSQL |
| `DB_SECRET` | Секрет для пользовательских JWT |
| `ADMIN_SECRET` | Секрет для админских JWT |
| `ADMIN_LOGIN` | Логин администратора по умолчанию |
| `ADMIN_PASSWORD` | Пароль администратора по умолчанию |
| `SMTP_HOST`, `SMTP_PORT` | SMTP-сервер для восстановления пароля |
| `SMTP_USER`, `SMTP_PASSWORD` | Учетные данные SMTP |
| `MAIL_FROM` | Адрес отправителя писем |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_BOT_USERNAME` | Username Telegram-бота |
| `TELEGRAM_PAYMENT_MODE` | Режим оплаты: provider или stars |
| `TELEGRAM_PAYMENT_PROVIDER_TOKEN` | Токен платежного провайдера Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет webhook-адреса |
| `TELEGRAM_PAYMENT_CURRENCY` | Валюта платежей |
| `TELEGRAM_STAR_BYN_RATE` | Курс для пересчета BYN в Telegram Stars |

## API endpoints

### Авторизация

| Method | Endpoint | Описание |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Регистрация пользователя |
| `POST` | `/api/auth/login` | Вход пользователя и выдача JWT |
| `POST` | `/api/auth/password-reset/request` | Запрос кода восстановления пароля |
| `POST` | `/api/auth/password-reset/confirm` | Подтверждение кода и смена пароля |

### Пользовательский кабинет

| Method | Endpoint | Описание |
| --- | --- | --- |
| `GET` | `/api/profile` | Получение профиля, показаний, задолженности и суммы к оплате |
| `PUT` | `/api/profile` | Обновление персональных данных |
| `GET` | `/api/tariffs` | Получение активных тарифов |
| `GET` | `/api/payments/history` | История платежей пользователя |
| `POST` | `/api/payments/fake` | Передача показаний и создание тестового начисления |
| `POST` | `/api/payments/fake/quick-pay` | Быстрая фиктивная оплата задолженности |

### Telegram-платежи

| Method | Endpoint | Описание |
| --- | --- | --- |
| `POST` | `/api/payments/telegram/orders` | Создание Telegram-платежа |
| `GET` | `/api/payments/telegram/orders/:id` | Проверка статуса платежа |
| `POST` | `/api/telegram/webhook/:secret` | Webhook для Telegram Bot API |

### Администрирование

| Method | Endpoint | Описание |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Вход администратора |
| `GET` | `/api/admin/logs` | Получение журнала аудита |
| `GET` | `/api/admin/logs/stream` | Server-Sent Events поток аудита |
| `GET` | `/api/admin/tables` | Список административных таблиц |
| `GET` | `/api/admin/tables/:tableName` | Получение строк выбранной таблицы |
| `POST` | `/api/admin/tables/:tableName` | Создание записи |
| `PUT` | `/api/admin/tables/:tableName/:id` | Обновление записи |
| `DELETE` | `/api/admin/tables/:tableName/:id` | Удаление записи |

## Структура проекта

```text
Diplom/
├── BackEnd/
│   ├── db/
│   │   ├── schema.sql                 # Основная схема PostgreSQL
│   │   ├── migrate_v2.sql             # Миграция для показаний, тарифов и платежей
│   │   └── fix_users_audit_logs_keys.sql
│   ├── .env.example                   # Пример переменных окружения
│   ├── index.js                       # Express API, авторизация, платежи, админка
│   ├── package.json
│   └── package-lock.json
├── FrontEnd/
│   ├── src/
│   │   ├── admin_page/                # Административная панель
│   │   ├── header/                    # Шапка сайта
│   │   ├── footer/                    # Подвал сайта
│   │   ├── home_page/                 # Главная страница личного кабинета
│   │   ├── protected_route/           # Защищенные React-маршруты
│   │   ├── sig_log/                   # Вход, регистрация, восстановление пароля
│   │   ├── user_page/                 # Профиль, показания и оплата
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── 01-er-database.mmd
│   ├── 02-class-diagram.mmd
│   ├── 03-use-case-diagram.mmd
│   ├── 04-sequence-diagram.mmd
│   ├── 05-cooperation-diagram.mmd
│   ├── 06-state-diagram.mmd
│   ├── 07-activity-diagram.mmd
│   ├── 08-component-diagram.mmd
│   ├── 09-deployment-diagram.mmd
│   └── obsidian-uml-diagrams.md
├── analog_screenshots/                # Аналоги сайтов водоканалов
├── generate_diploma.py                # Генерация дипломных материалов
├── dump-postgres-202606061205.sql     # SQL-дамп
└── README.md
```

## База данных

Проект использует PostgreSQL и хранит данные в связанных таблицах:

| Таблица | Назначение |
| --- | --- |
| `registration_data` | Учетные записи пользователей |
| `personalization_data` | Персональная информация абонента |
| `admins` | Администраторы системы |
| `water_balances` | Балансы и задолженность по типам воды |
| `water_meter_readings` | Последние показания счетчиков |
| `debtors` | Активные и закрытые задолженности |
| `audit_logs` | Журнал действий пользователей и администраторов |
| `password_reset_codes` | Коды восстановления пароля |
| `telegram_payment_orders` | Telegram-заказы и статусы оплат |
| `tariffs` | Тарифы на горячую и холодную воду |
| `fake_payments` | Учебные платежи и начисления по показаниям |

При регистрации пользователя backend автоматически создает персональную запись и стартовые строки для горячей и холодной воды. При передаче новых показаний приложение считает расход, применяет тарифы и создает запись задолженности.

## Основные сценарии

### Пользователь

1. Регистрируется на сайте, указывает ФИО, логин, адрес, телефон, email, дату рождения и пароль.
2. Входит в личный кабинет и видит приветствие, текущие показания и сумму к оплате.
3. Открывает профиль, редактирует персональные данные и сохраняет изменения.
4. Передает новые показания горячей и холодной воды.
5. Получает расчет начисления по тарифам и видит обновленную задолженность.
6. Проводит тестовую оплату или создает Telegram-платеж.
7. Следит за историей платежей на главной странице.

### Администратор

1. Входит в административный раздел.
2. Просматривает пользователей, профили, счетчики, задолженности, тарифы и платежи.
3. Добавляет, изменяет или удаляет записи в разрешенных таблицах.
4. Видит журнал аудита и поток новых событий в реальном времени.
5. Контролирует статусы должников и платежей.

## Проверка проекта

### Frontend

```bash
cd FrontEnd
npm run lint
npm run build
```

### Backend

```bash
cd BackEnd
npm start
```

Если PostgreSQL и `.env` настроены правильно, сервер создаст схему, применит миграцию, заполнит стартовые тарифы и запустится на `http://localhost:3000`.

## Документация и диаграммы

В папке `docs/` лежат Mermaid-диаграммы для дипломной документации:

- ER-диаграмма базы данных
- диаграмма классов
- use case diagram
- sequence diagram
- cooperation diagram
- state diagram
- activity diagram
- component diagram
- deployment diagram

Эти материалы помогают описать архитектуру сайта, связи между сущностями, пользовательские сценарии и логику взаимодействия frontend, backend и базы данных.
