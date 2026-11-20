-- =====================================================================
--  Shift catalog + bulk shift assignments
-- =====================================================================
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/AddShiftAssignments.sql
--
--  Safe to run more than once: tables use IF NOT EXISTS and the seed uses
--  ON CONFLICT (shift_name) DO NOTHING.
-- =====================================================================

BEGIN;

-- ---- 1. Shift catalog ---------------------------------------------------

CREATE TABLE IF NOT EXISTS "shift" (
    shift_id         SERIAL PRIMARY KEY,
    shift_name       VARCHAR(100) NOT NULL,
    start_time       TIME NOT NULL,
    duration_hours   NUMERIC(4,2) NOT NULL DEFAULT 10,
    end_time         TIME NOT NULL,
    crosses_midnight BOOLEAN NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shift_name UNIQUE (shift_name),
    CONSTRAINT ck_shift_duration CHECK (duration_hours > 0 AND duration_hours < 24)
);

-- ---- 2. One row per bulk assign action ---------------------------------

CREATE TABLE IF NOT EXISTS "assignment_batch" (
    batch_id          SERIAL PRIMARY KEY,
    shift_id          INTEGER NOT NULL REFERENCES "shift"(shift_id) ON DELETE RESTRICT,
    from_date         DATE NOT NULL,
    to_date           DATE NOT NULL,
    work_description  TEXT NULL,
    total_employees   INTEGER NOT NULL DEFAULT 0,
    status            VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_by        INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_assignment_batch_dates CHECK (to_date >= from_date),
    CONSTRAINT ck_assignment_batch_status CHECK (status IN ('Active', 'Cancelled')),
    CONSTRAINT ck_assignment_batch_total CHECK (total_employees >= 0)
);

-- ---- 3. One row per employee + shift date -------------------------------

CREATE TABLE IF NOT EXISTS "shift_assignment" (
    id             SERIAL PRIMARY KEY,
    batch_id       INTEGER NOT NULL REFERENCES "assignment_batch"(batch_id) ON DELETE CASCADE,
    emp_id         INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
    shift_id       INTEGER NOT NULL REFERENCES "shift"(shift_id) ON DELETE RESTRICT,
    shift_date     DATE NOT NULL,
    shift_start_dt TIMESTAMP NOT NULL,
    shift_end_dt   TIMESTAMP NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'Assigned',
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shift_assignment_emp_date UNIQUE (emp_id, shift_date),
    CONSTRAINT ck_shift_assignment_status CHECK (status IN ('Assigned', 'Cancelled')),
    CONSTRAINT ck_shift_assignment_window CHECK (shift_end_dt > shift_start_dt)
);

-- ---- 4. Indexes ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_shift_assignment_emp_window
    ON "shift_assignment" (emp_id, shift_start_dt, shift_end_dt);

CREATE INDEX IF NOT EXISTS ix_shift_assignment_batch
    ON "shift_assignment" (batch_id);

CREATE INDEX IF NOT EXISTS ix_shift_assignment_shift_date
    ON "shift_assignment" (shift_id, shift_date);

CREATE INDEX IF NOT EXISTS ix_assignment_batch_created
    ON "assignment_batch" (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_name_lower
    ON "shift" (LOWER(shift_name));

-- ---- 5. Seed editable example shifts -----------------------------------

INSERT INTO "shift" (shift_name, start_time, duration_hours, end_time, crosses_midnight, is_active)
VALUES
    ('Shift A', TIME '06:00', 10, TIME '16:00', FALSE, TRUE),
    ('Shift B', TIME '12:00', 10, TIME '22:00', FALSE, TRUE),
    ('Shift C', TIME '20:00', 10, TIME '06:00', TRUE, TRUE)
ON CONFLICT (shift_name) DO NOTHING;

COMMIT;

-- ---- Verify (optional) --------------------------------------------------
--  SELECT * FROM "shift" ORDER BY shift_id;
--  SELECT * FROM "assignment_batch" ORDER BY batch_id DESC LIMIT 10;
--  SELECT * FROM "shift_assignment" ORDER BY id DESC LIMIT 10;
