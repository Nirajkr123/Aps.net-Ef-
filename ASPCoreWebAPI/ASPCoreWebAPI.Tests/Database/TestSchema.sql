DROP TABLE IF EXISTS "test_fail_emp" CASCADE;
DROP TABLE IF EXISTS attendance_regularization CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS duty_plan_audit CASCADE;
DROP TABLE IF EXISTS duty_plan_segment CASCADE;
DROP TABLE IF EXISTS duty_plan CASCADE;
DROP TABLE IF EXISTS shift_assignment CASCADE;
DROP TABLE IF EXISTS assignment_batch CASCADE;
DROP TABLE IF EXISTS "shift" CASCADE;
DROP TABLE IF EXISTS attendance_config CASCADE;
DROP TABLE IF EXISTS "WorkLocations" CASCADE;
DROP TABLE IF EXISTS payroll_jobs CASCADE;
DROP TABLE IF EXISTS payslip_adjustments CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
DROP TABLE IF EXISTS deduction_rules CASCADE;
DROP TABLE IF EXISTS payroll_holidays CASCADE;
DROP TABLE IF EXISTS payroll_week_off_days CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS "Leaves" CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;
DROP TABLE IF EXISTS "Employees" CASCADE;
DROP TABLE IF EXISTS "Designations" CASCADE;
DROP TABLE IF EXISTS "Departments" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;

CREATE TYPE attendance_status AS ENUM
    ('Present', 'Absent', 'Half-day', 'Leave', 'Holiday', 'Late', 'MissingPunch');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE "Users" (
    "Id"        SERIAL PRIMARY KEY,
    "FirstName" VARCHAR(100) NOT NULL,
    "LastName"  VARCHAR(100) NOT NULL,
    "Email"     VARCHAR(255) NOT NULL,
    "Role"      VARCHAR(20) NOT NULL,
    "Status"    VARCHAR(20) NOT NULL DEFAULT 'Active'
);

CREATE TABLE "Designations" (
    "Id"    SERIAL PRIMARY KEY,
    "Title" VARCHAR(100) NOT NULL
);

CREATE TABLE "Departments" (
    "Id"    SERIAL PRIMARY KEY,
    "Name"  VARCHAR(150) NOT NULL
);

CREATE TABLE "Employees" (
    "Id"             SERIAL PRIMARY KEY,
    "UserId"         INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    "EmployeeCode"   VARCHAR(50) NOT NULL,
    "Status"         VARCHAR(20) NOT NULL DEFAULT 'Active',
    "DepartmentName" VARCHAR(100) NULL,
    "DepartmentId"   INTEGER NULL REFERENCES "Departments"("Id") ON DELETE SET NULL,
    "DesignationId"  INTEGER NULL REFERENCES "Designations"("Id") ON DELETE SET NULL,
    "DesignationTitle" VARCHAR(100) NULL
);

CREATE TABLE "Leaves" (
    "Id"           SERIAL PRIMARY KEY,
    "EmployeeId"   INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
    "LeaveType"    VARCHAR(50) NOT NULL,
    "StartDate"    DATE NOT NULL,
    "EndDate"      DATE NOT NULL,
    "Reason"       TEXT NULL,
    "Status"       VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "CreatedDate"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "Days"         INTEGER NOT NULL DEFAULT 1,
    "HalfDay"      BOOLEAN NOT NULL DEFAULT FALSE,
    "ReviewedBy"   TEXT NULL,
    "ReviewedOn"   TIMESTAMP NULL,
    "AdminComment" TEXT NULL
);

CREATE TABLE leave_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    is_paid     BOOLEAN NOT NULL DEFAULT TRUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO leave_types (name, is_paid) VALUES
    ('Casual', TRUE),
    ('Sick', TRUE),
    ('Earned', TRUE),
    ('Personal', TRUE),
    ('Unpaid', FALSE);

CREATE TABLE salary_structures (
    id              BIGSERIAL PRIMARY KEY,
    employee_id     INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE RESTRICT,
    basic           NUMERIC(14, 2) NOT NULL,
    hra             NUMERIC(14, 2) NOT NULL DEFAULT 0,
    allowances      NUMERIC(14, 2) NOT NULL DEFAULT 0,
    effective_from  DATE NOT NULL,
    created_by      INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_salary_structures_amounts
        CHECK (basic >= 0 AND hra >= 0 AND allowances >= 0)
);

CREATE INDEX ix_salary_structures_employee_effective
    ON salary_structures (employee_id, effective_from DESC);

CREATE TABLE deduction_rules (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL,
    value       NUMERIC(12, 4) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_deduction_rules_type
        CHECK (type IN ('FIXED', 'PERCENT_OF_BASIC', 'PERCENT_OF_GROSS')),
    CONSTRAINT ck_deduction_rules_value CHECK (value >= 0)
);

CREATE UNIQUE INDEX uq_deduction_rules_name
    ON deduction_rules (lower(name));

CREATE TABLE payroll_runs (
    id              BIGSERIAL PRIMARY KEY,
    month           SMALLINT NOT NULL,
    year            INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by      INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    approved_by     INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ NULL,
    published_at    TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_payroll_runs_month CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT ck_payroll_runs_year CHECK (year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_payroll_runs_status
        CHECK (status IN ('DRAFT', 'APPROVED', 'PUBLISHED')),
    CONSTRAINT uq_payroll_runs_period UNIQUE (month, year)
);

CREATE INDEX ix_payroll_runs_status
    ON payroll_runs (status, year DESC, month DESC);

CREATE TABLE payslips (
    id                BIGSERIAL PRIMARY KEY,
    run_id            BIGINT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id       INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE RESTRICT,
    version           INTEGER NOT NULL DEFAULT 1,
    gross             NUMERIC(14, 2) NOT NULL DEFAULT 0,
    lop_days          NUMERIC(5, 2) NOT NULL DEFAULT 0,
    lop_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
    adjustments       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_deductions  NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_pay           NUMERIC(14, 2) NOT NULL DEFAULT 0,
    items             JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings          JSONB NOT NULL DEFAULT '[]'::jsonb,
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    pdf_path          TEXT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_payslips_version CHECK (version >= 1),
    CONSTRAINT ck_payslips_lop_days CHECK (lop_days >= 0),
    CONSTRAINT ck_payslips_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT uq_payslips_run_employee_version UNIQUE (run_id, employee_id, version)
);

CREATE INDEX ix_payslips_run ON payslips (run_id);
CREATE INDEX ix_payslips_employee_status ON payslips (employee_id, status);

CREATE TABLE payslip_adjustments (
    id          BIGSERIAL PRIMARY KEY,
    payslip_id  BIGINT NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,
    amount      NUMERIC(14, 2) NOT NULL,
    note        TEXT NULL,
    created_by  INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_payslip_adjustments_type
        CHECK (type IN ('BONUS', 'ADVANCE', 'ARREARS', 'OTHER')),
    CONSTRAINT ck_payslip_adjustments_amount CHECK (amount <> 0)
);

CREATE INDEX ix_payslip_adjustments_payslip ON payslip_adjustments (payslip_id);

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity      VARCHAR(50) NOT NULL,
    entity_id   BIGINT NULL,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason      TEXT NULL,
    source      VARCHAR(20) NULL,
    "before"    JSONB NULL,
    "after"     JSONB NULL,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_audit_logs_entity ON audit_logs (entity, entity_id, at DESC);

CREATE TABLE payroll_holidays (
    id            BIGSERIAL PRIMARY KEY,
    holiday_date  DATE NOT NULL,
    name          TEXT NOT NULL,
    created_by    INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payroll_holidays_date UNIQUE (holiday_date)
);

CREATE TABLE payroll_week_off_days (
    day_of_week  SMALLINT PRIMARY KEY,
    CONSTRAINT ck_payroll_week_off_day CHECK (day_of_week BETWEEN 0 AND 6)
);

CREATE TABLE payroll_jobs (
    id          BIGSERIAL PRIMARY KEY,
    type        VARCHAR(30) NOT NULL,
    run_id      BIGINT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    payslip_id  BIGINT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    attempts    INTEGER NOT NULL DEFAULT 0,
    error       TEXT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_payroll_jobs_type
        CHECK (type IN ('CALCULATE_RUN', 'GENERATE_PDF')),
    CONSTRAINT ck_payroll_jobs_status
        CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING')),
    CONSTRAINT ck_payroll_jobs_target
        CHECK (run_id IS NOT NULL OR payslip_id IS NOT NULL)
);

CREATE INDEX ix_payroll_jobs_status_type ON payroll_jobs (status, type, created_at);
CREATE INDEX ix_payroll_jobs_run ON payroll_jobs (run_id);

CREATE TABLE "WorkLocations" (
    "Id"           SERIAL PRIMARY KEY,
    "Name"         VARCHAR(150) NOT NULL,
    "Latitude"     DOUBLE PRECISION NOT NULL,
    "Longitude"    DOUBLE PRECISION NOT NULL,
    "RadiusMeters" INTEGER NOT NULL DEFAULT 100,
    "IsActive"     BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE attendance_config (
    id                             SMALLINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    effective_from                 DATE NOT NULL DEFAULT DATE '2000-01-01',
    standard_hours                 NUMERIC(5,2) NOT NULL DEFAULT 10,
    max_hours_per_day              NUMERIC(5,2) NOT NULL DEFAULT 20,
    min_gap_same_day_minutes       INTEGER NOT NULL DEFAULT 240,
    min_rest_normal_minutes        INTEGER NOT NULL DEFAULT 480,
    rest_after_extended_minutes    INTEGER NOT NULL DEFAULT 480,
    max_extended_per_week          INTEGER NOT NULL DEFAULT 3,
    punch_early_minutes            INTEGER NOT NULL DEFAULT 30,
    punch_late_minutes             INTEGER NOT NULL DEFAULT 120,
    late_grace_minutes             INTEGER NOT NULL DEFAULT 10,
    unpaid_break_minutes           INTEGER NOT NULL DEFAULT 0,
    overtime_multiplier            NUMERIC(5,2) NOT NULL DEFAULT 1.50,
    checkout_buffer_minutes        INTEGER NOT NULL DEFAULT 240,
    half_day_min_hours             NUMERIC(4,2) NOT NULL DEFAULT 4,
    full_day_min_hours             NUMERIC(4,2) NOT NULL DEFAULT 8,
    timezone_id                    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    enforcement_mode               VARCHAR(10) NOT NULL DEFAULT 'WARN',
    missed_checkout_counts_as_present BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by                     INTEGER NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    CONSTRAINT ck_attendance_config_standard CHECK (standard_hours > 0 AND standard_hours <= 24),
    CONSTRAINT ck_attendance_config_max CHECK (max_hours_per_day >= standard_hours AND max_hours_per_day <= 24),
    CONSTRAINT ck_attendance_config_normal_rest CHECK (min_rest_normal_minutes >= 0),
    CONSTRAINT ck_attendance_config_checkout_buffer
        CHECK (checkout_buffer_minutes >= 0 AND checkout_buffer_minutes < 1440),
    CONSTRAINT ck_attendance_config_half_day
        CHECK (half_day_min_hours > 0 AND half_day_min_hours <= 24),
    CONSTRAINT ck_attendance_config_full_day
        CHECK (full_day_min_hours >= half_day_min_hours AND full_day_min_hours <= 24),
    CONSTRAINT ck_attendance_config_timezone
        CHECK (LENGTH(BTRIM(timezone_id)) > 0),
    CONSTRAINT ck_attendance_config_enforcement
        CHECK (enforcement_mode IN ('OFF', 'WARN', 'ENFORCE'))
);

CREATE UNIQUE INDEX uq_attendance_config_effective_from
    ON attendance_config (effective_from);

INSERT INTO attendance_config (effective_from) VALUES (DATE '2000-01-01');

CREATE TABLE "shift" (
    shift_id         SERIAL PRIMARY KEY,
    shift_name       VARCHAR(100) NOT NULL,
    start_time       TIME NOT NULL,
    duration_hours   NUMERIC(4,2) NOT NULL DEFAULT 10,
    end_time         TIME NOT NULL,
    crosses_midnight BOOLEAN NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    early_checkin_minutes    INTEGER NULL,
    grace_minutes            INTEGER NULL,
    late_limit_minutes       INTEGER NULL,
    checkout_buffer_minutes  INTEGER NULL,
    pending_rules            JSONB NULL,
    pending_rules_from       DATE NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shift_name UNIQUE (shift_name),
    CONSTRAINT ck_shift_duration CHECK (duration_hours > 0 AND duration_hours < 24),
    CONSTRAINT ck_shift_early_checkin
        CHECK (early_checkin_minutes IS NULL
               OR (early_checkin_minutes >= 0 AND early_checkin_minutes <= 1440)),
    CONSTRAINT ck_shift_grace
        CHECK (grace_minutes IS NULL
               OR (grace_minutes >= 0 AND grace_minutes <= 1440)),
    CONSTRAINT ck_shift_late_limit
        CHECK (late_limit_minutes IS NULL
               OR (late_limit_minutes >= 0 AND late_limit_minutes <= 1440)),
    CONSTRAINT ck_shift_checkout_buffer
        CHECK (checkout_buffer_minutes IS NULL
               OR (checkout_buffer_minutes >= 0 AND checkout_buffer_minutes < 1440)),
    CONSTRAINT ck_shift_pending_rules
        CHECK ((pending_rules IS NULL AND pending_rules_from IS NULL)
               OR (pending_rules IS NOT NULL AND pending_rules_from IS NOT NULL)),
    CONSTRAINT ck_shift_pending_rules_object
        CHECK (pending_rules IS NULL OR jsonb_typeof(pending_rules) = 'object')
);

CREATE TABLE "assignment_batch" (
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

CREATE TABLE duty_plan (
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

CREATE TABLE duty_plan_segment (
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

CREATE TABLE duty_plan_audit (
    id             SERIAL PRIMARY KEY,
    plan_id        INTEGER NOT NULL REFERENCES duty_plan(id) ON DELETE RESTRICT,
    action         VARCHAR(20) NOT NULL,
    actor_user_id  INTEGER NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    comment        TEXT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_duty_plan_audit_action
        CHECK (action IN ('Created', 'Approved', 'Rejected', 'Cancelled', 'Updated'))
);

CREATE TABLE shift_assignment (
    id             SERIAL PRIMARY KEY,
    batch_id       INTEGER NULL REFERENCES "assignment_batch"(batch_id) ON DELETE CASCADE,
    emp_id         INTEGER NOT NULL REFERENCES "Employees"("Id") ON DELETE CASCADE,
    shift_id       INTEGER NOT NULL REFERENCES "shift"(shift_id) ON DELETE RESTRICT,
    plan_id        INTEGER NULL REFERENCES duty_plan(id) ON DELETE RESTRICT,
    seq_no         SMALLINT NULL,
    shift_date     DATE NOT NULL,
    shift_start_dt TIMESTAMP NOT NULL,
    shift_end_dt   TIMESTAMP NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'Assigned',
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_shift_assignment_plan_seq CHECK (
        (plan_id IS NULL AND seq_no IS NULL)
        OR (plan_id IS NOT NULL AND seq_no BETWEEN 1 AND 2)
    ),
    CONSTRAINT ck_shift_assignment_status CHECK (status IN ('Assigned', 'Cancelled')),
    CONSTRAINT ck_shift_assignment_window CHECK (shift_end_dt > shift_start_dt)
);

CREATE INDEX ix_shift_assignment_emp_window
    ON shift_assignment (emp_id, shift_start_dt, shift_end_dt);
CREATE INDEX ix_shift_assignment_emp_status_window
    ON shift_assignment (emp_id, status, shift_start_dt, shift_end_dt);
CREATE INDEX ix_shift_assignment_batch
    ON shift_assignment (batch_id);
CREATE INDEX ix_shift_assignment_shift_date
    ON shift_assignment (shift_id, shift_date);
CREATE UNIQUE INDEX uq_shift_assignment_active_slot
    ON shift_assignment (emp_id, shift_id, shift_date)
    WHERE status = 'Assigned';
CREATE UNIQUE INDEX uq_shift_assignment_plan_seq
    ON shift_assignment (plan_id, seq_no)
    WHERE plan_id IS NOT NULL;
CREATE INDEX ix_assignment_batch_created
    ON assignment_batch (created_at DESC);
CREATE UNIQUE INDEX uq_shift_name_lower
    ON "shift" (LOWER(shift_name));
CREATE INDEX ix_duty_plan_employee_date
    ON duty_plan (employee_id, duty_date);
CREATE INDEX ix_duty_plan_status_date
    ON duty_plan (status, duty_date);
CREATE INDEX ix_duty_plan_segment_plan
    ON duty_plan_segment (plan_id);
CREATE INDEX ix_duty_plan_audit_plan
    ON duty_plan_audit (plan_id, created_at);

CREATE TABLE attendance (
    id                        SERIAL PRIMARY KEY,
    employee_id               INTEGER NOT NULL REFERENCES "Employees"("Id"),
    attendance_date           DATE NOT NULL,
    shift_assignment_id       INTEGER NULL REFERENCES shift_assignment(id) ON DELETE RESTRICT,
    check_in_time             TIMESTAMP NULL,
    check_out_time            TIMESTAMP NULL,
    working_hours             NUMERIC(5,2) NULL,
    status                    attendance_status NOT NULL DEFAULT 'Present',
    is_late                   BOOLEAN NOT NULL DEFAULT FALSE,
    location                  VARCHAR(255) NULL,
    ip_address                VARCHAR(64) NULL,
    check_in_latitude         DOUBLE PRECISION NULL,
    check_in_longitude        DOUBLE PRECISION NULL,
    check_in_accuracy         DOUBLE PRECISION NULL,
    check_out_latitude        DOUBLE PRECISION NULL,
    check_out_longitude       DOUBLE PRECISION NULL,
    check_out_accuracy        DOUBLE PRECISION NULL,
    check_in_location_name    VARCHAR(255) NULL,
    check_out_location_name   VARCHAR(255) NULL,
    check_in_location_id      INTEGER NULL REFERENCES "WorkLocations"("Id") ON DELETE SET NULL,
    check_out_location_id     INTEGER NULL REFERENCES "WorkLocations"("Id") ON DELETE SET NULL,
    check_in_distance_meters  DOUBLE PRECISION NULL,
    check_out_distance_meters DOUBLE PRECISION NULL,
    missing_punch_detected_at TIMESTAMP NULL,
    source                    VARCHAR(20) NOT NULL DEFAULT 'SELF',
    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_attendance_source
        CHECK (source IN ('SELF', 'ADMIN_OVERRIDE', 'REGULARIZATION', 'SYSTEM'))
);

CREATE UNIQUE INDEX uq_attendance_assignment
    ON attendance (shift_assignment_id)
    WHERE shift_assignment_id IS NOT NULL;
CREATE UNIQUE INDEX uq_attendance_legacy_employee_date
    ON attendance (employee_id, attendance_date)
    WHERE shift_assignment_id IS NULL;
CREATE UNIQUE INDEX uq_attendance_open_link
    ON attendance (employee_id)
    WHERE shift_assignment_id IS NOT NULL AND check_out_time IS NULL;
CREATE INDEX ix_attendance_shift_assignment
    ON attendance (shift_assignment_id);

CREATE TRIGGER trg_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_config_updated_at
    BEFORE UPDATE ON attendance_config
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE attendance_regularization (
    id                        SERIAL PRIMARY KEY,
    shift_assignment_id       INTEGER NOT NULL REFERENCES shift_assignment(id) ON DELETE RESTRICT,
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

CREATE UNIQUE INDEX uq_attendance_regularization_pending
    ON attendance_regularization (shift_assignment_id)
    WHERE status = 'Pending';
CREATE INDEX ix_attendance_regularization_employee
    ON attendance_regularization (employee_id, status, created_at DESC);

CREATE TABLE "test_fail_emp" (
    emp_id INTEGER PRIMARY KEY
);

CREATE OR REPLACE FUNCTION test_fail_shift_assignment() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "test_fail_emp" WHERE emp_id = NEW.emp_id) THEN
        RAISE EXCEPTION 'forced test failure for employee %', NEW.emp_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_test_fail_shift_assignment
    BEFORE INSERT ON shift_assignment
    FOR EACH ROW EXECUTE FUNCTION test_fail_shift_assignment();
