-- =====================================================================
--  Work locations + attendance location references
-- =====================================================================
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/AddWorkLocations.sql
--
--  Safe to run more than once.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "WorkLocations" (
    "Id"           SERIAL PRIMARY KEY,
    "Name"         VARCHAR(150) NOT NULL,
    "Latitude"     DOUBLE PRECISION NOT NULL,
    "Longitude"    DOUBLE PRECISION NOT NULL,
    "RadiusMeters" INTEGER NOT NULL DEFAULT 100,
    "IsActive"     BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
    "UpdatedAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "CK_WorkLocations_Latitude"
        CHECK ("Latitude" BETWEEN -90 AND 90),
    CONSTRAINT "CK_WorkLocations_Longitude"
        CHECK ("Longitude" BETWEEN -180 AND 180),
    CONSTRAINT "CK_WorkLocations_Radius"
        CHECK ("RadiusMeters" > 0)
);

ALTER TABLE "attendance"
    ADD COLUMN IF NOT EXISTS "check_in_location_id"  INTEGER,
    ADD COLUMN IF NOT EXISTS "check_out_location_id" INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_check_in_location'
    ) THEN
        ALTER TABLE "attendance"
            ADD CONSTRAINT "fk_attendance_check_in_location"
            FOREIGN KEY ("check_in_location_id")
            REFERENCES "WorkLocations" ("Id")
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_check_out_location'
    ) THEN
        ALTER TABLE "attendance"
            ADD CONSTRAINT "fk_attendance_check_out_location"
            FOREIGN KEY ("check_out_location_id")
            REFERENCES "WorkLocations" ("Id")
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "IX_attendance_check_in_location_id"
    ON "attendance" ("check_in_location_id");
CREATE INDEX IF NOT EXISTS "IX_attendance_check_out_location_id"
    ON "attendance" ("check_out_location_id");

COMMENT ON TABLE "WorkLocations" IS 'Allowed office/work sites for employee attendance geofencing';
COMMENT ON COLUMN "attendance"."check_in_location_id" IS 'WorkLocations row matched during check-in';
COMMENT ON COLUMN "attendance"."check_out_location_id" IS 'WorkLocations row matched during check-out';

COMMIT;
