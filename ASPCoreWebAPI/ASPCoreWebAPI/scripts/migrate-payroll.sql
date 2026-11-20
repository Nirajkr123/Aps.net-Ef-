-- =====================================================================
--  Payroll module migration
-- ---------------------------------------------------------------------
--  Idempotent: safely re-runnable.
--
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/migrate-payroll.sql
--
--  DISCLAIMER:
--  PF / ESI / Professional Tax / TDS rules state aur salary ke hisaab se
--  alag hote hain. Deductions configurable rakhe gaye hain (hardcode nahi).
--  Live salary par chalane se pehle CA / payroll expert se verify karwana
--  zaroori hai.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  Salary structures
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS salary_structures (
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

CREATE INDEX IF NOT EXISTS ix_salary_structures_employee_effective
    ON salary_structures (employee_id, effective_from DESC);

-- ---------------------------------------------------------------------
--  Deduction rules (configurable, never hardcoded)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deduction_rules (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    type        VARCHAR(30) NOT NULL,
    value       NUMERIC(12, 4) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_deduction_rules_type
        CHECK (type IN ('FIXED', 'PERCENT_OF_BASIC', 'PERCENT_OF_GROSS')),
    CONSTRAINT ck_deduction_rules_value
        CHECK (value >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deduction_rules_name
    ON deduction_rules (lower(name));

-- ---------------------------------------------------------------------
--  Payroll runs
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payroll_runs (
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

CREATE INDEX IF NOT EXISTS ix_payroll_runs_status
    ON payroll_runs (status, year DESC, month DESC);

-- ---------------------------------------------------------------------
--  Payslips
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payslips (
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

CREATE INDEX IF NOT EXISTS ix_payslips_run
    ON payslips (run_id);

CREATE INDEX IF NOT EXISTS ix_payslips_employee_status
    ON payslips (employee_id, status);

-- ---------------------------------------------------------------------
--  Payslip adjustments
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payslip_adjustments (
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

CREATE INDEX IF NOT EXISTS ix_payslip_adjustments_payslip
    ON payslip_adjustments (payslip_id);

-- ---------------------------------------------------------------------
--  Audit logs
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity      VARCHAR(50) NOT NULL,
    entity_id   BIGINT NULL,
    details     JSONB NOT NULL DEFAULT '{}'::jsonb,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_entity
    ON audit_logs (entity, entity_id, at DESC);

-- ---------------------------------------------------------------------
--  Payroll calendar: holidays + weekly offs
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payroll_holidays (
    id            BIGSERIAL PRIMARY KEY,
    holiday_date  DATE NOT NULL,
    name          TEXT NOT NULL,
    created_by    INTEGER NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payroll_holidays_date UNIQUE (holiday_date)
);

CREATE TABLE IF NOT EXISTS payroll_week_off_days (
    day_of_week  SMALLINT PRIMARY KEY,
    CONSTRAINT ck_payroll_week_off_day CHECK (day_of_week BETWEEN 0 AND 6)
);

-- Sunday is the default weekly off. Admin can replace this list later.
INSERT INTO payroll_week_off_days (day_of_week)
VALUES (0)
ON CONFLICT (day_of_week) DO NOTHING;

-- ---------------------------------------------------------------------
--  Background jobs
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payroll_jobs (
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

CREATE INDEX IF NOT EXISTS ix_payroll_jobs_status_type
    ON payroll_jobs (status, type, created_at);

CREATE INDEX IF NOT EXISTS ix_payroll_jobs_run
    ON payroll_jobs (run_id);

COMMIT;
