-- ============================================
-- HRMS Attendance Module Schema
-- Database: DapperDemoDb
-- ============================================

-- 1. Create enum type (skip if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Half-day', 'Leave', 'Holiday', 'Late');
    END IF;
END
$$;

-- 2. Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id              SERIAL PRIMARY KEY,
    employee_id     INTEGER NOT NULL REFERENCES "Employees"("Id"),
    attendance_date DATE NOT NULL,
    check_in_time   TIMESTAMP NULL,
    check_out_time  TIMESTAMP NULL,
    working_hours   NUMERIC(5,2) NULL,
    status          attendance_status NOT NULL DEFAULT 'Present',
    is_late         BOOLEAN NOT NULL DEFAULT FALSE,
    location        VARCHAR(255) NULL,
    ip_address      VARCHAR(50) NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_date UNIQUE (employee_id, attendance_date)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance (employee_id);

-- 4. Create employee_shift_settings table
CREATE TABLE IF NOT EXISTS employee_shift_settings (
    employee_id      INTEGER PRIMARY KEY REFERENCES "Employees"("Id"),
    shift_start      TIME NOT NULL DEFAULT '09:30:00',
    shift_end        TIME NOT NULL DEFAULT '18:30:00',
    grace_minutes    INTEGER NOT NULL DEFAULT 15,
    min_half_day_hrs NUMERIC(4,2) NOT NULL DEFAULT 4.0,
    full_day_hrs     NUMERIC(4,2) NOT NULL DEFAULT 8.0
);

-- 5. Create trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- HRMS Notification Module Schema
-- ============================================

-- 7. notification_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM
            ('CheckIn', 'CheckOut', 'Leave', 'Announcement', 'Payslip', 'Document', 'General');
    END IF;
END
$$;

-- 8. notifications table (one row per recipient)
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    employee_id INTEGER NULL REFERENCES "Employees"("Id") ON DELETE SET NULL,
    type        notification_type NOT NULL DEFAULT 'General',
    title       VARCHAR(150) NOT NULL,
    message     VARCHAR(500) NOT NULL,
    link        VARCHAR(255) NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMP NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

-- 9. fcm_tokens table (device tokens for web push)
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    token      VARCHAR(500) NOT NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fcm_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens (user_id);

-- 10. trigger for fcm_tokens.updated_at
DROP TRIGGER IF EXISTS trg_fcm_tokens_updated_at ON fcm_tokens;
CREATE TRIGGER trg_fcm_tokens_updated_at
    BEFORE UPDATE ON fcm_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
