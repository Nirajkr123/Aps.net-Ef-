-- =====================================================================
--  Attendance enforcement foundation (Step 1)
-- =====================================================================
--  Adds:
--    · attendance_config enforcement defaults and timezone
--    · per-shift optional rule overrides + one pending future snapshot
--    · attendance.source
--    · audit_logs before/after/reason/source columns
--
--  Run after AddExtendedDuty.sql, AddShiftAssignments.sql,
--  AddShiftConflictPolicy.sql and migrate-payroll.sql.
--
--  Safe to run more than once: columns/indexes/constraints are guarded.
--  No existing attendance, shift or assignment row is deleted.
-- =====================================================================

BEGIN;

-- ---- 1. Company-wide attendance policy --------------------------------

ALTER TABLE attendance_config
    ADD COLUMN IF NOT EXISTS checkout_buffer_minutes INTEGER NOT NULL DEFAULT 240,
    ADD COLUMN IF NOT EXISTS half_day_min_hours NUMERIC(4,2) NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS full_day_min_hours NUMERIC(4,2) NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS timezone_id TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS enforcement_mode VARCHAR(10) NOT NULL DEFAULT 'WARN',
    ADD COLUMN IF NOT EXISTS missed_checkout_counts_as_present BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE attendance_config
    ALTER COLUMN punch_early_minutes SET DEFAULT 30,
    ALTER COLUMN punch_late_minutes SET DEFAULT 120,
    ALTER COLUMN late_grace_minutes SET DEFAULT 10,
    ALTER COLUMN checkout_buffer_minutes SET DEFAULT 240,
    ALTER COLUMN half_day_min_hours SET DEFAULT 4,
    ALTER COLUMN full_day_min_hours SET DEFAULT 8,
    ALTER COLUMN timezone_id SET DEFAULT 'Asia/Kolkata',
    ALTER COLUMN enforcement_mode SET DEFAULT 'WARN',
    ALTER COLUMN missed_checkout_counts_as_present SET DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_attendance_config_checkout_buffer'
           AND conrelid = 'attendance_config'::regclass
    ) THEN
        ALTER TABLE attendance_config
            ADD CONSTRAINT ck_attendance_config_checkout_buffer
            CHECK (checkout_buffer_minutes >= 0 AND checkout_buffer_minutes < 1440);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_attendance_config_half_day'
           AND conrelid = 'attendance_config'::regclass
    ) THEN
        ALTER TABLE attendance_config
            ADD CONSTRAINT ck_attendance_config_half_day
            CHECK (half_day_min_hours > 0 AND half_day_min_hours <= 24);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_attendance_config_full_day'
           AND conrelid = 'attendance_config'::regclass
    ) THEN
        ALTER TABLE attendance_config
            ADD CONSTRAINT ck_attendance_config_full_day
            CHECK (full_day_min_hours >= half_day_min_hours AND full_day_min_hours <= 24);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_attendance_config_timezone'
           AND conrelid = 'attendance_config'::regclass
    ) THEN
        ALTER TABLE attendance_config
            ADD CONSTRAINT ck_attendance_config_timezone
            CHECK (LENGTH(BTRIM(timezone_id)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_attendance_config_enforcement'
           AND conrelid = 'attendance_config'::regclass
    ) THEN
        ALTER TABLE attendance_config
            ADD CONSTRAINT ck_attendance_config_enforcement
            CHECK (enforcement_mode IN ('OFF', 'WARN', 'ENFORCE'));
    END IF;
END
$$;

-- attendance_config is versioned. AddShiftConflictPolicy owns the id
-- sequence and the effective_from uniqueness requirement.
DO $$
DECLARE
    id_is_identity TEXT;
BEGIN
    SELECT is_identity INTO id_is_identity
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'attendance_config'
       AND column_name = 'id';

    IF id_is_identity = 'NO' THEN
        CREATE SEQUENCE IF NOT EXISTS attendance_config_id_seq;
        ALTER SEQUENCE attendance_config_id_seq OWNED BY attendance_config.id;
        ALTER TABLE attendance_config ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE attendance_config
            ALTER COLUMN id SET DEFAULT nextval('attendance_config_id_seq');
        PERFORM setval(
            'attendance_config_id_seq',
            GREATEST((SELECT COALESCE(MAX(id), 0) FROM attendance_config), 1),
            TRUE
        );
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_config_effective_from
    ON attendance_config (effective_from);

-- ---- 2. Per-shift optional overrides + pending next-day snapshot ------

ALTER TABLE "shift"
    ADD COLUMN IF NOT EXISTS early_checkin_minutes INTEGER NULL,
    ADD COLUMN IF NOT EXISTS grace_minutes INTEGER NULL,
    ADD COLUMN IF NOT EXISTS late_limit_minutes INTEGER NULL,
    ADD COLUMN IF NOT EXISTS checkout_buffer_minutes INTEGER NULL,
    ADD COLUMN IF NOT EXISTS pending_rules JSONB NULL,
    ADD COLUMN IF NOT EXISTS pending_rules_from DATE NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_shift_early_checkin'
           AND conrelid = '"shift"'::regclass
    ) THEN
        ALTER TABLE "shift"
            ADD CONSTRAINT ck_shift_early_checkin
            CHECK (early_checkin_minutes IS NULL
                   OR (early_checkin_minutes >= 0 AND early_checkin_minutes <= 1440));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_shift_grace'
           AND conrelid = '"shift"'::regclass
    ) THEN
        ALTER TABLE "shift"
            ADD CONSTRAINT ck_shift_grace
            CHECK (grace_minutes IS NULL
                   OR (grace_minutes >= 0 AND grace_minutes <= 1440));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_shift_late_limit'
           AND conrelid = '"shift"'::regclass
    ) THEN
        ALTER TABLE "shift"
            ADD CONSTRAINT ck_shift_late_limit
            CHECK (late_limit_minutes IS NULL
                   OR (late_limit_minutes >= 0 AND late_limit_minutes <= 1440));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_shift_checkout_buffer'
           AND conrelid = '"shift"'::regclass
    ) THEN
        ALTER TABLE "shift"
            ADD CONSTRAINT ck_shift_checkout_buffer
            CHECK (checkout_buffer_minutes IS NULL
                   OR (checkout_buffer_minutes >= 0 AND checkout_buffer_minutes < 1440));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_shift_pending_rules'
           AND conrelid = '"shift"'::regclass
    ) THEN
        ALTER TABLE "shift"
            ADD CONSTRAINT ck_shift_pending_rules
            CHECK ((pending_rules IS NULL AND pending_rules_from IS NULL)
                   OR (pending_rules IS NOT NULL AND pending_rules_from IS NOT NULL));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_shift_pending_rules_object'
           AND conrelid = '"shift"'::regclass
    ) THEN
        ALTER TABLE "shift"
            ADD CONSTRAINT ck_shift_pending_rules_object
            CHECK (pending_rules IS NULL OR jsonb_typeof(pending_rules) = 'object');
    END IF;
END
$$;

-- ---- 3. Attendance source ---------------------------------------------

ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'SELF';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'ck_attendance_source'
           AND conrelid = 'attendance'::regclass
    ) THEN
        ALTER TABLE attendance
            ADD CONSTRAINT ck_attendance_source
            CHECK (source IN ('SELF', 'ADMIN_OVERRIDE', 'REGULARIZATION', 'SYSTEM'));
    END IF;
END
$$;

-- ---- 4. Audit metadata ------------------------------------------------

DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT NULL';
        EXECUTE 'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) NULL';
        EXECUTE 'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "before" JSONB NULL';
        EXECUTE 'ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "after" JSONB NULL';
    END IF;
END
$$;

-- ---- 5. Initial policy version with approved defaults ----------------

DO $$
DECLARE
    base_row attendance_config%ROWTYPE;
    new_row attendance_config%ROWTYPE;
    audit_exists BOOLEAN;
BEGIN
    SELECT * INTO base_row
      FROM attendance_config
     ORDER BY effective_from DESC, id DESC
     LIMIT 1;

    IF base_row.id IS NULL THEN
        INSERT INTO attendance_config (effective_from)
        VALUES (CURRENT_DATE)
        RETURNING * INTO new_row;
    ELSE
        INSERT INTO attendance_config (
            effective_from,
            standard_hours,
            max_hours_per_day,
            min_gap_same_day_minutes,
            min_rest_normal_minutes,
            rest_after_extended_minutes,
            max_extended_per_week,
            punch_early_minutes,
            punch_late_minutes,
            late_grace_minutes,
            unpaid_break_minutes,
            overtime_multiplier,
            checkout_buffer_minutes,
            half_day_min_hours,
            full_day_min_hours,
            timezone_id,
            enforcement_mode,
            missed_checkout_counts_as_present,
            updated_by
        )
        VALUES (
            CURRENT_DATE,
            base_row.standard_hours,
            base_row.max_hours_per_day,
            base_row.min_gap_same_day_minutes,
            base_row.min_rest_normal_minutes,
            base_row.rest_after_extended_minutes,
            base_row.max_extended_per_week,
            30,
            120,
            10,
            base_row.unpaid_break_minutes,
            base_row.overtime_multiplier,
            240,
            4,
            8,
            'Asia/Kolkata',
            'WARN',
            TRUE,
            NULL
        )
        ON CONFLICT (effective_from) DO UPDATE SET
            punch_early_minutes = EXCLUDED.punch_early_minutes,
            punch_late_minutes = EXCLUDED.punch_late_minutes,
            late_grace_minutes = EXCLUDED.late_grace_minutes,
            checkout_buffer_minutes = EXCLUDED.checkout_buffer_minutes,
            half_day_min_hours = EXCLUDED.half_day_min_hours,
            full_day_min_hours = EXCLUDED.full_day_min_hours,
            timezone_id = EXCLUDED.timezone_id,
            enforcement_mode = EXCLUDED.enforcement_mode,
            missed_checkout_counts_as_present = EXCLUDED.missed_checkout_counts_as_present,
            updated_at = NOW()
        RETURNING * INTO new_row;
    END IF;

    SELECT to_regclass('public.audit_logs') IS NOT NULL INTO audit_exists;

    IF audit_exists THEN
        INSERT INTO audit_logs (
            action, entity, entity_id, source, "before", "after", details
        )
        VALUES (
            'ATTENDANCE_CONFIG_VERSIONED',
            'attendance_config',
            new_row.id,
            'SYSTEM',
            CASE WHEN base_row.id IS NULL THEN NULL ELSE to_jsonb(base_row) END,
            to_jsonb(new_row),
            jsonb_build_object(
                'before', CASE WHEN base_row.id IS NULL THEN NULL ELSE to_jsonb(base_row) END,
                'after', to_jsonb(new_row)
            )
        );
    END IF;
END
$$;

COMMIT;

-- =====================================================================
--  Verify:
--   SELECT * FROM attendance_config ORDER BY effective_from DESC;
--   SELECT shift_id, early_checkin_minutes, grace_minutes,
--          late_limit_minutes, checkout_buffer_minutes,
--          pending_rules, pending_rules_from
--     FROM "shift" ORDER BY shift_id;
--   SELECT source, COUNT(*) FROM attendance GROUP BY source;
-- =====================================================================
