-- =====================================================================
--  Rollback attendance enforcement foundation (Step 1)
-- =====================================================================
--  Drops only the columns/constraints added by
--  AddAttendanceEnforcement.sql.
--
--  Existing attendance, shift, assignment and attendance_config rows are
--  preserved. The policy version inserted by the forward migration is not
--  deleted; it remains readable after the new columns are dropped.
-- =====================================================================

BEGIN;

ALTER TABLE "shift"
    DROP COLUMN IF EXISTS pending_rules_from CASCADE,
    DROP COLUMN IF EXISTS pending_rules CASCADE,
    DROP COLUMN IF EXISTS checkout_buffer_minutes CASCADE,
    DROP COLUMN IF EXISTS late_limit_minutes CASCADE,
    DROP COLUMN IF EXISTS grace_minutes CASCADE,
    DROP COLUMN IF EXISTS early_checkin_minutes CASCADE;

ALTER TABLE attendance
    DROP COLUMN IF EXISTS source CASCADE;

ALTER TABLE attendance_config
    DROP COLUMN IF EXISTS missed_checkout_counts_as_present CASCADE,
    DROP COLUMN IF EXISTS enforcement_mode CASCADE,
    DROP COLUMN IF EXISTS timezone_id CASCADE,
    DROP COLUMN IF EXISTS full_day_min_hours CASCADE,
    DROP COLUMN IF EXISTS half_day_min_hours CASCADE,
    DROP COLUMN IF EXISTS checkout_buffer_minutes CASCADE;

ALTER TABLE attendance_config
    ALTER COLUMN punch_early_minutes SET DEFAULT 60,
    ALTER COLUMN punch_late_minutes SET DEFAULT 120,
    ALTER COLUMN late_grace_minutes SET DEFAULT 15;

DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE audit_logs DROP COLUMN IF EXISTS "after" CASCADE';
        EXECUTE 'ALTER TABLE audit_logs DROP COLUMN IF EXISTS "before" CASCADE';
        EXECUTE 'ALTER TABLE audit_logs DROP COLUMN IF EXISTS source CASCADE';
        EXECUTE 'ALTER TABLE audit_logs DROP COLUMN IF EXISTS reason CASCADE';
    END IF;
END
$$;

COMMIT;
