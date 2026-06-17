-- Migration: Change datetime to date, rename balances to water_balances
-- Run this once on existing databases

-- Step 1: Change TIMESTAMPTZ columns to DATE where time is not needed
-- registration_data.created_at
ALTER TABLE registration_data ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE registration_data ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;

-- personalization_data
ALTER TABLE personalization_data ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE personalization_data ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;
ALTER TABLE personalization_data ALTER COLUMN updated_at TYPE DATE USING updated_at::date;
ALTER TABLE personalization_data ALTER COLUMN updated_at SET DEFAULT CURRENT_DATE;

-- admins
ALTER TABLE admins ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE admins ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;

-- debtors
ALTER TABLE debtors ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE debtors ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;
ALTER TABLE debtors ALTER COLUMN closed_at TYPE DATE USING closed_at::date;

-- audit_logs
ALTER TABLE audit_logs ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;

-- password_reset_codes (keep expires_at as TIMESTAMPTZ)
ALTER TABLE password_reset_codes ALTER COLUMN used_at TYPE DATE USING used_at::date;
ALTER TABLE password_reset_codes ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE password_reset_codes ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;

-- telegram_payment_orders
ALTER TABLE telegram_payment_orders ALTER COLUMN created_at TYPE DATE USING created_at::date;
ALTER TABLE telegram_payment_orders ALTER COLUMN created_at SET DEFAULT CURRENT_DATE;
ALTER TABLE telegram_payment_orders ALTER COLUMN invoice_sent_at TYPE DATE USING invoice_sent_at::date;
ALTER TABLE telegram_payment_orders ALTER COLUMN paid_at TYPE DATE USING paid_at::date;
ALTER TABLE telegram_payment_orders ALTER COLUMN cancelled_at TYPE DATE USING cancelled_at::date;

-- Step 2: Create water_balances table
CREATE TABLE IF NOT EXISTS water_balances (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    water_type TEXT NOT NULL CHECK (water_type IN ('hot_water', 'cold_water')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'BYN',
    updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (registration_id, water_type)
);


-- Step 2.1: Store actual meter readings separately from debts/payments
CREATE TABLE IF NOT EXISTS water_meter_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id BIGINT NOT NULL REFERENCES registration_data(id) ON DELETE CASCADE,
    water_type TEXT NOT NULL CHECK (water_type IN ('hot_water', 'cold_water')),
    current_reading NUMERIC(12, 3) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'м3',
    updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (registration_id, water_type)
);

CREATE INDEX IF NOT EXISTS idx_water_meter_readings_registration_id ON water_meter_readings(registration_id);

-- Step 3: Migrate existing balance data
-- Split each user's single balance into hot_water and cold_water rows
DO $$
BEGIN
    IF to_regclass('public.balances') IS NOT NULL THEN
        INSERT INTO water_balances (registration_id, water_type, amount, currency, updated_at)
        SELECT
            registration_id,
            'hot_water',
            COALESCE(amount, 0),
            COALESCE(currency, 'BYN'),
            COALESCE(updated_at::date, CURRENT_DATE)
        FROM balances
        ON CONFLICT (registration_id, water_type) DO NOTHING;

        INSERT INTO water_balances (registration_id, water_type, amount, currency, updated_at)
        SELECT
            registration_id,
            'cold_water',
            0,
            COALESCE(currency, 'BYN'),
            COALESCE(updated_at::date, CURRENT_DATE)
        FROM balances
        ON CONFLICT (registration_id, water_type) DO NOTHING;
    END IF;
END $$;

-- Ensure all users without a balance row get both types
INSERT INTO water_balances (registration_id, water_type, amount)
SELECT r.id, 'hot_water', 0
FROM registration_data r
LEFT JOIN water_balances wb ON wb.registration_id = r.id AND wb.water_type = 'hot_water'
WHERE wb.id IS NULL;

INSERT INTO water_balances (registration_id, water_type, amount)
SELECT r.id, 'cold_water', 0
FROM registration_data r
LEFT JOIN water_balances wb ON wb.registration_id = r.id AND wb.water_type = 'cold_water'
WHERE wb.id IS NULL;

-- Step 4: Drop old balances table (after verifying migration)
-- DROP TABLE IF EXISTS balances;

-- Step 5: Create tariffs table
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

-- Insert official tariffs for June 2025. Old demo tariffs are removed
-- so the tariff table contains only актуальные строки.
DELETE FROM tariffs
WHERE water_type IN ('hot_water', 'cold_water');

INSERT INTO tariffs (water_type, rate_per_unit, unit, currency, effective_from, is_active)
VALUES ('cold_water', 1.8494, 'м3', 'BYN', DATE '2025-06-01', true);

INSERT INTO tariffs (water_type, rate_per_unit, unit, currency, effective_from, is_active)
VALUES ('hot_water', 27.2323, 'Гкал', 'BYN', DATE '2025-06-01', true);

-- Step 6: Create fake_payments table
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


ALTER TABLE fake_payments ADD COLUMN IF NOT EXISTS previous_reading NUMERIC(12, 3);
ALTER TABLE fake_payments ADD COLUMN IF NOT EXISTS current_reading NUMERIC(12, 3);
ALTER TABLE fake_payments ADD COLUMN IF NOT EXISTS consumption NUMERIC(12, 3);
ALTER TABLE fake_payments ADD COLUMN IF NOT EXISTS tariff_rate NUMERIC(10, 4);
ALTER TABLE fake_payments ADD COLUMN IF NOT EXISTS unit TEXT;

-- Step 7: Add new indexes
CREATE INDEX IF NOT EXISTS idx_water_balances_registration_id ON water_balances(registration_id);
CREATE INDEX IF NOT EXISTS idx_water_balances_water_type ON water_balances(water_type);
CREATE INDEX IF NOT EXISTS idx_tariffs_water_type ON tariffs(water_type);
CREATE INDEX IF NOT EXISTS idx_fake_payments_registration_id ON fake_payments(registration_id);
