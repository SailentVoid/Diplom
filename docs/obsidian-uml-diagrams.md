# UML-диаграммы проекта для Obsidian

Файл рассчитан на Obsidian: все блоки ниже оформлены как `mermaid` и отображаются в режиме чтения. Для строгих UML-нотаций, которых нет в Mermaid напрямую, использован совместимый формат `flowchart`.

## ER-диаграмма базы данных

```mermaid
erDiagram
    registration_data ||--o| personalization_data : "profile"
    registration_data ||--o| admins : "admin account"
    registration_data ||--o| balances : "balance"
    registration_data ||--o{ debtors : "debts"
    registration_data ||--o{ password_reset_codes : "reset codes"
    audit_logs }o--o| registration_data : "user actor or entity"
    audit_logs }o--o| admins : "admin actor"

    registration_data {
        BIGINT id PK
        TEXT fio
        TEXT login UK
        TEXT street
        TEXT password_hash
        TIMESTAMPTZ created_at
    }

    personalization_data {
        BIGINT id PK
        BIGINT registration_id FK "UNIQUE"
        TEXT full_name
        DATE birth_date
        TEXT phone
        TEXT email
        TEXT residential_address
        TEXT registration_address
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    admins {
        BIGINT id PK
        BIGINT registration_id FK "UNIQUE"
        TEXT login UK
        TEXT password_hash
        TEXT role
        BOOLEAN is_active
        TIMESTAMPTZ created_at
    }

    balances {
        BIGINT id PK
        BIGINT registration_id FK "UNIQUE"
        NUMERIC amount
        CHAR currency
        TIMESTAMPTZ updated_at
    }

    debtors {
        BIGINT id PK
        BIGINT registration_id FK
        NUMERIC debt_amount
        TEXT reason
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ closed_at
    }

    audit_logs {
        BIGINT id PK
        TEXT actor_type
        BIGINT actor_id
        TEXT actor_login
        TEXT action
        TEXT entity_table
        BIGINT entity_id
        JSONB changes
        TEXT ip_address
        TIMESTAMPTZ created_at
    }

    password_reset_codes {
        BIGINT id PK
        BIGINT registration_id FK
        TEXT email
        TEXT code_hash
        INTEGER attempts
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ used_at
        TIMESTAMPTZ created_at
    }

    users {
        INTEGER id PK
        VARCHAR fio
        VARCHAR login
        VARCHAR street
        VARCHAR password
    }
```

## Диаграмма классов

```mermaid
classDiagram
    class RegistrationData {
        +bigint id
        +string fio
        +string login
        +string street
        +string password_hash
        +datetime created_at
    }

    class PersonalizationData {
        +bigint id
        +bigint registration_id
        +string full_name
        +date birth_date
        +string phone
        +string email
        +string residential_address
        +string registration_address
        +datetime created_at
        +datetime updated_at
    }

    class Admin {
        +bigint id
        +bigint registration_id
        +string login
        +string password_hash
        +string role
        +boolean is_active
        +datetime created_at
    }

    class Balance {
        +bigint id
        +bigint registration_id
        +decimal amount
        +string currency
        +datetime updated_at
    }

    class Debtor {
        +bigint id
        +bigint registration_id
        +decimal debt_amount
        +string reason
        +boolean is_active
        +datetime created_at
        +datetime closed_at
    }

    class AuditLog {
        +bigint id
        +string actor_type
        +bigint actor_id
        +string actor_login
        +string action
        +string entity_table
        +bigint entity_id
        +json changes
        +string ip_address
        +datetime created_at
    }

    class PasswordResetCode {
        +bigint id
        +bigint registration_id
        +string email
        +string code_hash
        +int attempts
        +datetime expires_at
        +datetime used_at
        +datetime created_at
    }

    RegistrationData "1" --> "0..1" PersonalizationData : owns
    RegistrationData "1" --> "0..1" Admin : may_have
    RegistrationData "1" --> "0..1" Balance : owns
    RegistrationData "1" --> "0..*" Debtor : has
    RegistrationData "1" --> "0..*" PasswordResetCode : requests
    AuditLog ..> RegistrationData : user_actor_or_entity
    AuditLog ..> Admin : admin_actor
```

## Диаграмма вариантов использования

```mermaid
flowchart LR
    User["Пользователь"]
    Admin["Администратор"]

    subgraph System["Информационная система водоканала"]
        UC_Register(("Регистрация"))
        UC_Login(("Вход"))
        UC_Profile(("Просмотр профиля"))
        UC_EditProfile(("Редактирование профиля"))
        UC_ResetPassword(("Восстановление пароля"))
        UC_AdminLogin(("Вход администратора"))
        UC_ViewTables(("Просмотр таблиц"))
        UC_EditTables(("Редактирование данных"))
        UC_ViewAudit(("Просмотр журнала аудита"))
    end

    User --> UC_Register
    User --> UC_Login
    User --> UC_Profile
    User --> UC_EditProfile
    User --> UC_ResetPassword

    Admin --> UC_AdminLogin
    Admin --> UC_ViewTables
    Admin --> UC_EditTables
    Admin --> UC_ViewAudit

    UC_EditProfile -. "создает запись" .-> UC_ViewAudit
    UC_EditTables -. "создает запись" .-> UC_ViewAudit
```

## Диаграмма последовательностей

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant UI as React UI
    participant API as Express API
    participant DB as PostgreSQL
    participant Audit as audit_logs

    User->>UI: Заполняет форму регистрации
    UI->>API: POST /api/auth/register
    API->>API: Проверка обязательных полей
    API->>API: Хеширование пароля bcrypt
    API->>DB: BEGIN
    API->>DB: INSERT registration_data
    API->>DB: INSERT personalization_data
    API->>DB: INSERT balances
    API->>Audit: INSERT user_register
    API->>DB: COMMIT
    API-->>UI: 201 Created
    UI-->>User: Регистрация выполнена
```

## Диаграмма кооперации

```mermaid
flowchart LR
    User["1. Пользователь"]
    UI["2. React UI"]
    API["3. Express API"]
    Profile["4. personalization_data"]
    Audit["5. audit_logs"]

    User -- "1: изменяет профиль" --> UI
    UI -- "2: PUT /api/profile" --> API
    API -- "3: SELECT old profile" --> Profile
    API -- "4: UPDATE profile" --> Profile
    API -- "5: buildAuditChanges()" --> API
    API -- "6: INSERT audit record" --> Audit
    API -- "7: success response" --> UI
    UI -- "8: показывает результат" --> User
```

## Диаграмма состояний

```mermaid
stateDiagram-v2
    [*] --> Guest
    Guest : Нет активного JWT-токена

    Guest --> Registering: Открыта регистрация
    Registering --> Authenticated: Регистрация успешна
    Registering --> Guest: Ошибка валидации

    Guest --> Authenticating: Отправлен логин и пароль
    Authenticating --> Authenticated: JWT получен
    Authenticating --> Guest: Неверные данные

    Authenticated : Пользователь вошел
    Authenticated --> EditingProfile: Редактирует профиль
    EditingProfile --> Authenticated: Профиль сохранен
    EditingProfile --> Authenticated: Изменения отклонены

    Guest --> ResetRequested: Запрошен код восстановления
    ResetRequested --> PasswordChanged: Код подтвержден
    PasswordChanged --> Guest: Новый вход

    Authenticated --> Guest: Выход или истечение токена
```

## Диаграмма деятельности

```mermaid
flowchart TD
    Start([Старт])
    OpenForm[Открыть форму восстановления пароля]
    EnterEmail[Ввести email]
    SendRequest[Отправить запрос кода]
    EmailFound{Email найден?}
    GenerateCode[Сгенерировать шестизначный код]
    SaveHash[Сохранить хеш кода и срок действия]
    SendEmail[Отправить код на email или вывести в консоль]
    EnterCode[Ввести email, код и новый пароль]
    CodeValid{Код верный и не истек?}
    HashPassword[Захешировать новый пароль]
    UpdatePassword[Обновить registration_data.password_hash]
    MarkUsed[Пометить код использованным]
    WriteAudit[Записать событие в audit_logs]
    Finish([Пароль обновлен])
    Error([Показать ошибку])

    Start --> OpenForm --> EnterEmail --> SendRequest --> EmailFound
    EmailFound -- "да" --> GenerateCode --> SaveHash --> SendEmail --> EnterCode
    EmailFound -- "нет" --> SendEmail
    EnterCode --> CodeValid
    CodeValid -- "да" --> HashPassword --> UpdatePassword --> MarkUsed --> WriteAudit --> Finish
    CodeValid -- "нет" --> Error
```

## Диаграмма компонентов

```mermaid
flowchart LR
    subgraph Frontend["Frontend: FrontEnd"]
        ReactApp["<<component>> React SPA"]
        AuthPages["<<component>> Auth pages"]
        UserPage["<<component>> User cabinet"]
        AdminPage["<<component>> Admin panel"]
    end

    subgraph Backend["Backend: Node.js"]
        Express["<<component>> Express API"]
        Auth["<<component>> Auth service"]
        AdminApi["<<component>> Admin table API"]
        AuditService["<<component>> Audit service"]
        Mailer["<<component>> Mail sender"]
    end

    subgraph Data["Data layer"]
        PostgreSQL[("PostgreSQL")]
        Registration[("registration_data")]
        Personalization[("personalization_data")]
        AuditLogs[("audit_logs")]
    end

    ReactApp --> AuthPages
    ReactApp --> UserPage
    ReactApp --> AdminPage
    AuthPages -- "HTTP JSON" --> Express
    UserPage -- "HTTP JSON" --> Express
    AdminPage -- "HTTP JSON + SSE" --> Express
    Express --> Auth
    Express --> AdminApi
    Express --> AuditService
    Express --> Mailer
    Auth --> PostgreSQL
    AdminApi --> PostgreSQL
    AuditService --> AuditLogs
    PostgreSQL --> Registration
    PostgreSQL --> Personalization
```

## Диаграмма развертывания

```mermaid
flowchart TB
    subgraph ClientNode["Узел: устройство пользователя"]
        Browser["Браузер"]
    end

    subgraph AppNode["Узел: сервер приложения"]
        StaticFiles["Vite/React static files"]
        NodeProcess["Node.js process"]
        ExpressApi["Express API :3000"]
    end

    subgraph DbNode["Узел: сервер БД"]
        PgServer[("PostgreSQL")]
        AppDatabase[("Database")]
    end

    subgraph MailNode["Узел: SMTP-сервер"]
        Smtp["SMTP service"]
    end

    Browser -- "HTTPS/HTTP" --> StaticFiles
    Browser -- "HTTP JSON, SSE" --> ExpressApi
    StaticFiles --> NodeProcess
    NodeProcess --> ExpressApi
    ExpressApi -- "pg protocol" --> PgServer
    PgServer --> AppDatabase
    ExpressApi -- "SMTP" --> Smtp
```
