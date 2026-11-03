-- =====================================================================
--  Attendance distance-from-work-location columns
-- =====================================================================
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/AddAttendanceDistance.sql
--
--  Safe to run more than once: every ADD COLUMN uses IF NOT EXISTS.
-- =====================================================================

BEGIN;

ALTER TABLE "attendance"
    ADD COLUMN IF NOT EXISTS "check_in_distance_meters"  double precision,
    ADD COLUMN IF NOT EXISTS "check_out_distance_meters" double precision;

COMMENT ON COLUMN "attendance"."check_in_distance_meters"  IS 'Distance in meters between check-in GPS and the matched work location';
COMMENT ON COLUMN "attendance"."check_out_distance_meters" IS 'Distance in meters between check-out GPS and the matched work location';

COMMIT;
