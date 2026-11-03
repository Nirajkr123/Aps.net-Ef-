-- =====================================================================
--  Extended duty + per-assignment attendance
-- =====================================================================
--  Part 1 of the extended-duty feature.
--
--  Adds:
--    · attendance_config          one-row typed policy configuration
--    · duty_plan                  maker-checker extended duty plan
--    · duty_plan_segment          up to two proposed split segments
--    · duty_plan_audit            plan transition history
--    · attendance_regularization  missing-punch correction requests
--    · shift_assignment.plan_id / seq_no
--    · attendance.shift_assignment_id
--    · MissingPunch attendance status
--    · multi-assignment uniqueness instead of one-shift-per-day
--
--  Existing rows are preserved. No table or column is dropped.
--
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/AddExtendedDuty.sql
--
--  Safe to run more than once: every object is guarded.
-- =====================================================================

-- Enum values cannot be used in the same transaction that adds them.
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'MissingPunch';

BEGIN;

-- ---- 1. Policy configuration ------------------------------------------

CREATE TABLE IF NOT EXISTS attendance_config (
    id                             SMALLINT PRIMARY KEY DEFAULT 1,
    standard_hours                 NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_hours_per_day              NUMERIC(5,2) NOT NULL DEFAULT 20,
    min_gap_same_day_minutes       INTEGER NOT NULL DEFAULT 240,
    rest_after_extended_minutes    INTEGER NOT NULL DEFAULT 480,
    max_extended_per_week          INTEGER NOT NULL DEFAULT 3,
    punch_early_minutes            INTEGER NOT NULL DEFAULT 60,
    punch_late_minutes             INTEGER NOT NULL DEFAULT 120,
    late_grace_minutes             INTEGER NOT NULL DEFAULT 15,
    unpaid_break_minutes           INTEGER NOT NULL DEFAULT 0,
    overtime_multiplier            NUMERIC(5,2) NOT NULL DEFAULT 1.50,
    updated_at                     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by                     INTEGER NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    CONSTRAINT ck_attendance_config_singleton CHECK (id = 1),
    CONSTRAINT ck_attendance_config_standard CHECK (standard_hours > 0 AND standard_hours <= 24),
    CONSTRAINT ck_attendance_config_max CHECK (max_hours_per_day >= standard_hours AND max_hours_per_day <= 24),
    CONSTRAINT ck_attendance_config_gap CHECK (min_gap_same_day_minutes >= 0),
    CONSTRAINT ck_attendance_config_rest CHECK (rest_after_extended_minutes >= 0),
    CONSTRAINT ck_attendance_config_week CHECK (max_extended_per_week >= 0),
    CONSTRAINT ck_attendance_config_punch CHECK (punch_early_minutes >= 0 AND punch_late_minutes >= 0),
    CONSTRAINT ck_attendance_config_grace CHECK (late_grace_minutes >= 0),
    CONSTRAINT ck_attendance_config_break CHECK (unpaid_break_minutes >= 0 AND unpaid_break_minutes < 1440),
    CONSTRAINT ck_attendance_config_multiplier CHECK (overtime_multiplier > 0)
);

INSERT INTO attendance_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_attendance_config_updated_at ON attendance_config;
CREATE TRIGGER trg_attendance_config_updated_at
    BEFORE UPDATE ON attendance_config
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- 2. Duty plan ------------------------------------------------------

CREATE TABLE IF NOT EXISTS duty_plan (
    id                 SERIAL PRIMARY KEY,
    employee_id        INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE RESTRICT,
    duty_date          DATE NOT NULL,
    location_id        INTEGER NOT NULL REFERENCES "WorkLocations"("Id") ON DELETE RESTRICT,
    mode               VARCHAR(20) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'Pending',
    planned_start_dt   TIMESTAMP NOT NULL,
    planned_end_dt     TIMESTAMP NOT NULL,
    total_hours        NUMERIC(5,2) NOT NULL,
    reason             TEXT NULL,
    created_by         INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    approved_by        INTEGER NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    approved_at        TIMESTAMP NULL,
    rejected_by        INTEGER NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    rejected_at        TIMESTAMP NULL,
    cancelled_by       INTEGER NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    cancelled_at       TIMESTAMP NULL,
    decision_comment   TEXT NULL,
    CONSTRAINT ck_duty_plan_mode CHECK (mode IN ('CONTINUOUS', 'SPLIT')),
    CONSTRAINT ck_duty_plan_status CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    CONSTRAINT ck_duty_plan_window CHECK (planned_end_dt > planned_start_dt),
    CONSTRAINT ck_duty_plan_hours CHECK (total_hours > 0 AND total_hours <= 20),
    CONSTRAINT ck_duty_plan_no_self_approval CHECK (approved_by IS NULL OR approved_by <> created_by)
);

CREATE TABLE IF NOT EXISTS duty_plan_segment (
    id               SERIAL PRIMARY KEY,
    plan_id          INTEGER NOT NULL REFERENCES duty_plan(id) ON DELETE RESTRICT,
    seq_no           SMALLINT NOT NULL,
    shift_id         INTEGER NOT NULL REFERENCES "shift"(shift_id) ON DELETE RESTRICT,
    planned_start_dt TIMESTAMP NOT NULL,
    planned_end_dt   TIMESTAMP NOT NULL,
    hours            NUMERIC(5,2) NOT NULL,
    CONSTRAINT uq_duty_plan_segment_seq UNIQUE (plan_id, seq_no),
    CONSTRAINT ck_duty_plan_segment_seq CHECK (seq_no BETWEEN 1 AND 2),
    CONSTRAINT ck_duty_plan_segment_window CHECK (planned_end_dt > planned_start_dt),
    CONSTRAINT ck_duty_plan_segment_hours CHECK (hours > 0 AND hours <= 20)
);

CREATE TABLE IF NOT EXISTS duty_plan_audit (
    id             SERIAL PRIMARY KEY,
    plan_id        INTEGER NOT NULL REFERENCES duty_plan(id) ON DELETE RESTRICT,
    action         VARCHAR(20) NOT NULL,
    actor_user_id  INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    comment        TEXT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_duty_plan_audit_action
        CHECK (action IN ('Created', 'Approved', 'Rejected', 'Cancelled', 'Updated'))
);

CREATE INDEX IF NOT EXISTS ix_duty_plan_employee_date
    ON duty_plan (employee_id, duty_date);
CREATE INDEX IF NOT EXISTS ix_duty_plan_status_date
    ON duty_plan (status, duty_date);
CREATE INDEX IF NOT EXISTS ix_duty_plan_segment_plan
    ON duty_plan_segment (plan_id);
CREATE INDEX IF NOT EXISTS ix_duty_plan_audit_plan
    ON duty_plan_audit (plan_id, created_at);

-- ---- 3. Shift assignment: plan link + multi-shift uniqueness ----------

ALTER TABLE "shift_assignment"
    ADD COLUMN IF NOT EXISTS plan_id INTEGER NULL,
    ADD COLUMN IF NOT EXISTS seq_no SMALLINT NULL;

ALTER TABLE "shift_assignment"
    ALTER COLUMN batch_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_shift_assignment_plan'
    ) THEN
        ALTER TABLE "shift_assignment"
            ADD CONSTRAINT fk_shift_assignment_plan
            FOREIGN KEY (plan_id) REFERENCES duty_plan(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_shift_assignment_plan_seq'
    ) THEN
        ALTER TABLE "shift_assignment"
            ADD CONSTRAINT ck_shift_assignment_plan_seq
            CHECK (
                (plan_id IS NULL AND seq_no IS NULL)
                OR (plan_id IS NOT NULL AND seq_no BETWEEN 1 AND 2)
            );
    END IF;
END $$;

ALTER TABLE "shift_assignment"
    DROP CONSTRAINT IF EXISTS uq_shift_assignment_emp_date;
DROP INDEX IF EXISTS uq_shift_assignment_emp_date;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_assignment_active_slot
    ON "shift_assignment" (emp_id, shift_id, shift_date)
    WHERE status = 'Assigned';

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_assignment_plan_seq
    ON "shift_assignment" (plan_id, seq_no)
    WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_shift_assignment_emp_status_window
    ON "shift_assignment" (emp_id, status, shift_start_dt, shift_end_dt);

-- ---- 4. Attendance: assignment link + per-assignment uniqueness -------

ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS shift_assignment_id INTEGER NULL,
    ADD COLUMN IF NOT EXISTS missing_punch_detected_at TIMESTAMP NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_shift_assignment'
    ) THEN
        ALTER TABLE attendance
            ADD CONSTRAINT fk_attendance_shift_assignment
            FOREIGN KEY (shift_assignment_id)
            REFERENCES "shift_assignment"(id) ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS uq_employee_date;
DROP INDEX IF EXISTS uq_employee_date;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_assignment
    ON attendance (shift_assignment_id)
    WHERE shift_assignment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_legacy_employee_date
    ON attendance (employee_id, attendance_date)
    WHERE shift_assignment_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_open_link
    ON attendance (employee_id)
    WHERE shift_assignment_id IS NOT NULL AND check_out_time IS NULL;

CREATE INDEX IF NOT EXISTS ix_attendance_shift_assignment
    ON attendance (shift_assignment_id);

-- ---- 5. Missing-punch regularization -----------------------------------

CREATE TABLE IF NOT EXISTS attendance_regularization (
    id                        SERIAL PRIMARY KEY,
    shift_assignment_id       INTEGER NOT NULL REFERENCES "shift_assignment"(id) ON DELETE RESTRICT,
    employee_id               INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE RESTRICT,
    requested_check_in_time   TIMESTAMP NULL,
    requested_check_out_time  TIMESTAMP NULL,
    reason                    TEXT NOT NULL,
    status                    VARCHAR(20) NOT NULL DEFAULT 'Pending',
    requested_by_user_id      INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_by               INTEGER NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    reviewed_at               TIMESTAMP NULL,
    admin_comment             TEXT NULL,
    CONSTRAINT ck_attendance_regularization_status
        CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    CONSTRAINT ck_attendance_regularization_times
        CHECK (
            requested_check_in_time IS NULL
            OR requested_check_out_time IS NULL
            OR requested_check_out_time > requested_check_in_time
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_regularization_pending
    ON attendance_regularization (shift_assignment_id)
    WHERE status = 'Pending';

CREATE INDEX IF NOT EXISTS ix_attendance_regularization_employee
    ON attendance_regularization (employee_id, status, created_at DESC);

-- ---- 6. Verify ---------------------------------------------------------
--  SELECT * FROM attendance_config;
--  SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--   WHERE table_name IN ('shift_assignment', 'attendance', 'duty_plan')
--   ORDER BY table_name, ordinal_position;

COMMIT;
