CREATE TABLE IF NOT EXISTS registration_data (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fio TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    street TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS personalization_data (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL UNIQUE REFERENCES registration_data(id) ON DELETE CASCADE,
    full_name TEXT,
    birth_date DATE,
    phone TEXT,
    email TEXT,
    residential_address TEXT,
    registration_address TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS admins (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT UNIQUE REFERENCES registration_data(id) ON DELETE CASCADE,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS water_balances (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    water_type TEXT NOT NULL CHECK (water_type IN ('hot_water', 'cold_water')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'BYN',
    updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (registration_id, water_type)
);


CREATE TABLE IF NOT EXISTS water_meter_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    water_type TEXT NOT NULL CHECK (water_type IN ('hot_water', 'cold_water')),
    current_reading NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'м3',
    updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (registration_id, water_type)
);

CREATE TABLE IF NOT EXISTS debtors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    debt_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_at DATE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_type TEXT NOT NULL,
    actor_id BIGINT,
    actor_login TEXT,
    action TEXT NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id BIGINT,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS password_reset_codes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at DATE,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS telegram_payment_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'BYN',
    payment_method TEXT NOT NULL DEFAULT 'telegram_provider' CHECK (payment_method IN ('telegram_provider', 'telegram_stars')),
    invoice_currency CHAR(3) NOT NULL DEFAULT 'BYN',
    invoice_amount INTEGER NOT NULL DEFAULT 0 CHECK (invoice_amount >= 0),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'invoice_sent', 'paid', 'failed', 'cancelled')),
    telegram_payload TEXT NOT NULL UNIQUE,
    telegram_chat_id BIGINT,
    telegram_username TEXT,
    description TEXT,
    telegram_payment_charge_id TEXT,
    provider_payment_charge_id TEXT,
    raw_update JSONB,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_sent_at DATE,
    paid_at DATE,
    cancelled_at DATE
);

CREATE TABLE IF NOT EXISTS tariffs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    water_type TEXT NOT NULL CHECK (water_type IN ('hot_water', 'cold_water')),
    rate_per_unit NUMERIC(10, 4) NOT NULL CHECK (rate_per_unit >= 0),
    unit TEXT NOT NULL DEFAULT 'm3',
    currency CHAR(3) NOT NULL DEFAULT 'BYN',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS fake_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BYN',
    water_type TEXT NOT NULL CHECK (water_type IN ('hot_water', 'cold_water')),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    previous_reading NUMERIC(12, 3),
    current_reading NUMERIC(12, 3),
    consumption NUMERIC(12, 3),
    tariff_rate NUMERIC(10, 4),
    unit TEXT,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_water_balances_registration_id ON water_balances(registration_id);
CREATE INDEX IF NOT EXISTS idx_water_balances_water_type ON water_balances(water_type);
CREATE INDEX IF NOT EXISTS idx_water_meter_readings_registration_id ON water_meter_readings(registration_id);
CREATE INDEX IF NOT EXISTS idx_debtors_registration_id ON debtors(registration_id);
CREATE INDEX IF NOT EXISTS idx_debtors_is_active ON debtors(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_registration_id ON password_reset_codes(registration_id);
CREATE INDEX IF NOT EXISTS idx_telegram_payment_orders_registration_id ON telegram_payment_orders(registration_id);
CREATE INDEX IF NOT EXISTS idx_telegram_payment_orders_payload ON telegram_payment_orders(telegram_payload);
CREATE INDEX IF NOT EXISTS idx_telegram_payment_orders_status ON telegram_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_tariffs_water_type ON tariffs(water_type);
CREATE INDEX IF NOT EXISTS idx_fake_payments_registration_id ON fake_payments(registration_id);
