-- =====================================================================
--  Attendance monthly register
--  Adds employee exit/location, half-day leave, register settings,
--  immutable month snapshots and lock versions.
--  Safe to run more than once.
-- =====================================================================

BEGIN;

-- ---- Employees -------------------------------------------------------

ALTER TABLE "Employees"
    ADD COLUMN IF NOT EXISTS "ExitDate" DATE NULL,
    ADD COLUMN IF NOT EXISTS "WorkLocationId" INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_employees_work_location'
          AND conrelid = '"Employees"'::regclass
    ) THEN
        ALTER TABLE "Employees"
            ADD CONSTRAINT fk_employees_work_location
            FOREIGN KEY ("WorkLocationId")
            REFERENCES "WorkLocations"("Id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_employees_exit_date
    ON "Employees" ("ExitDate");

CREATE INDEX IF NOT EXISTS ix_employees_work_location
    ON "Employees" ("WorkLocationId");

CREATE INDEX IF NOT EXISTS ix_employees_manager_status
    ON "Employees" ("ManagerId", "Status");

-- ---- Leave types + half day -----------------------------------------

CREATE TABLE IF NOT EXISTS leave_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    is_paid     BOOLEAN NOT NULL DEFAULT TRUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_types_name
    ON leave_types (lower(name));

INSERT INTO leave_types (name, is_paid) VALUES
    ('Casual', TRUE),
    ('Sick', TRUE),
    ('Earned', TRUE),
    ('Personal', TRUE),
    ('Unpaid', FALSE)
ON CONFLICT DO NOTHING;

ALTER TABLE "Leaves"
    ADD COLUMN IF NOT EXISTS "HalfDay" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Leaves"
    ALTER COLUMN "Days" TYPE NUMERIC(4,1)
    USING "Days"::numeric(4,1);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_leaves_half_day'
          AND conrelid = '"Leaves"'::regclass
    ) THEN
        ALTER TABLE "Leaves"
            ADD CONSTRAINT ck_leaves_half_day
            CHECK (NOT "HalfDay" OR ("StartDate"::date = "EndDate"::date));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_leaves_employee_status_range
    ON "Leaves" ("EmployeeId", "Status", "StartDate", "EndDate");

-- ---- Attendance settings --------------------------------------------

ALTER TABLE attendance_config
    ADD COLUMN IF NOT EXISTS sandwich_rule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS half_day_lop_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Register manual marks need a stable display code. Underlying attendance
-- status stays inside the existing enum (Leave/Holiday/Present...), while the
-- code keeps paid/unpaid leave and week-off distinctions.
ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS register_code VARCHAR(4) NULL;

-- ---- Register locks + snapshots -------------------------------------

CREATE TABLE IF NOT EXISTS attendance_register_locks (
    id              BIGSERIAL PRIMARY KEY,
    year            SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    version         INTEGER NOT NULL CHECK (version >= 1),
    payroll_run_id  BIGINT NULL REFERENCES payroll_runs(id) ON DELETE SET NULL,
    locked_by       INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason          TEXT NULL,
    settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (year, month, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_register_lock_payroll_run
    ON attendance_register_locks (payroll_run_id)
    WHERE payroll_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS attendance_register_snapshot (
    id              BIGSERIAL PRIMARY KEY,
    lock_id         BIGINT NOT NULL REFERENCES attendance_register_locks(id) ON DELETE CASCADE,
    employee_id     INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE RESTRICT,
    employee_code   TEXT NULL,
    employee_name   TEXT NOT NULL,
    department_id   INTEGER NULL,
    department_name TEXT NULL,
    location_id     INTEGER NULL,
    location_name   TEXT NULL,
    joining_date    DATE NULL,
    exit_date       DATE NULL,
    shift_ids       INTEGER[] NOT NULL DEFAULT '{}',
    days            JSONB NOT NULL,
    totals          JSONB NOT NULL,
    flags           JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (lock_id, employee_id)
);

CREATE INDEX IF NOT EXISTS ix_register_snapshot_lock
    ON attendance_register_snapshot (lock_id, employee_id);

-- ---- Query indexes ---------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_shift_assignment_emp_shift_date
    ON "shift_assignment" (emp_id, shift_date);

CREATE INDEX IF NOT EXISTS ix_attendance_employee_date
    ON attendance (employee_id, attendance_date);

COMMIT;
