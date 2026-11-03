-- =====================================================================
--  Attendance geolocation columns
-- =====================================================================
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/AddAttendanceLocation.sql
--
--  Safe to run more than once: every ADD COLUMN uses IF NOT EXISTS.
-- =====================================================================

BEGIN;

ALTER TABLE "attendance"
    ADD COLUMN IF NOT EXISTS "check_in_latitude"  double precision,
    ADD COLUMN IF NOT EXISTS "check_in_longitude" double precision,
    ADD COLUMN IF NOT EXISTS "check_in_accuracy"  double precision,
    ADD COLUMN IF NOT EXISTS "check_out_latitude"  double precision,
    ADD COLUMN IF NOT EXISTS "check_out_longitude" double precision,
    ADD COLUMN IF NOT EXISTS "check_out_accuracy"  double precision,
    ADD COLUMN IF NOT EXISTS "check_in_location_name"  text,
    ADD COLUMN IF NOT EXISTS "check_out_location_name" text;

COMMENT ON COLUMN "attendance"."check_in_latitude"  IS 'Browser geolocation latitude at check-in';
COMMENT ON COLUMN "attendance"."check_in_longitude" IS 'Browser geolocation longitude at check-in';
COMMENT ON COLUMN "attendance"."check_in_accuracy"  IS 'Browser geolocation accuracy in meters at check-in';
COMMENT ON COLUMN "attendance"."check_out_latitude"  IS 'Browser geolocation latitude at check-out';
COMMENT ON COLUMN "attendance"."check_out_longitude" IS 'Browser geolocation longitude at check-out';
COMMENT ON COLUMN "attendance"."check_out_accuracy"  IS 'Browser geolocation accuracy in meters at check-out';
COMMENT ON COLUMN "attendance"."check_in_location_name"  IS 'Reverse-geocoded area, city and state at check-in';
COMMENT ON COLUMN "attendance"."check_out_location_name" IS 'Reverse-geocoded area, city and state at check-out';

COMMIT;
