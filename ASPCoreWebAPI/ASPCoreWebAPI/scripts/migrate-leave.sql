-- =====================================================================
--  Leave module migration  —  review metadata + day count + integrity
-- =====================================================================
--  Kyu: `Leaves` table me sirf apply-time columns the. Real leave workflow
--  ke liye chahiye tha:
--    · Days            — request apply karte waqt calculate hokar store
--                         hota hai (frontend par recalculate karna fragile
--                         hai, aur approve ke time par wahi number use hota
--                         hai balance katne ke liye)
--    · ReviewedBy      — kis admin ne approve/reject kiya
--    · ReviewedOn      — kab review hua
--    · AdminComment    — reject karte waqt ka mandatory comment
--
--  Ye script IDEMPOTENT hai — `IF NOT EXISTS` / `DO $$` guards ke saath.
--  Dobara chalane se kuch duplicate ya error nahi hoga.
--
--  ROLLBACK (pehle wala shape):
--   ALTER TABLE "Leaves"
--     DROP COLUMN IF EXISTS "Days",
--     DROP COLUMN IF EXISTS "ReviewedBy",
--     DROP COLUMN IF EXISTS "ReviewedOn",
--     DROP COLUMN IF EXISTS "AdminComment";
--
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/migrate-leave.sql
-- =====================================================================

BEGIN;

-- ---- 1. Naye columns ----------------------------------------------------

ALTER TABLE "Leaves" ADD COLUMN IF NOT EXISTS "Days"        integer;
ALTER TABLE "Leaves" ADD COLUMN IF NOT EXISTS "ReviewedBy"  text;
ALTER TABLE "Leaves" ADD COLUMN IF NOT EXISTS "ReviewedOn"  timestamp;
ALTER TABLE "Leaves" ADD COLUMN IF NOT EXISTS "AdminComment" text;

-- ---- 2. Purane rows ka Days backfill -----------------------------------
--  Inclusive count: 12 Sep se 20 Sep = 9 din. Sab days gin-te hain
--  (weekend included) — ye frontend ke `countLeaveDays()` se match karta hai.

UPDATE "Leaves"
   SET "Days" = ("EndDate"::date - "StartDate"::date) + 1
 WHERE "Days" IS NULL;

-- Ab se har nayi row par default 1, aur NULL nahi ja sakta.

ALTER TABLE "Leaves" ALTER COLUMN "Days" SET DEFAULT 1;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Leaves" WHERE "Days" IS NULL) THEN
        RAISE EXCEPTION 'Leaves.Days ab bhi NULL hai — backfill fail ho gaya';
    END IF;

    EXECUTE 'ALTER TABLE "Leaves" ALTER COLUMN "Days" SET NOT NULL';
END $$;

-- ---- 3. Data hygiene ----------------------------------------------------
--  Status 'pending'/'approved' (lowercase) bhi aa sakta hai agar kisi ne
--  purane code se direct insert kiya. App PascalCase maanta hai, isiliye
--  normalize kar dete hain taaki filter/compare silent fail na ho.

UPDATE "Leaves"
   SET "Status" = initcap("Status")
 WHERE "Status" <> initcap("Status")
   AND "Status" IS NOT NULL;

--  Status sirf 4 values me se ek, aur StartDate <= EndDate.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Leaves"
         WHERE "Status" NOT IN ('Pending', 'Approved', 'Rejected', 'Cancelled')
    ) THEN
        RAISE EXCEPTION 'Leaves.Status me unknown value hai — manually fix karo';
    END IF;

    IF EXISTS (SELECT 1 FROM "Leaves" WHERE "EndDate" < "StartDate") THEN
        RAISE EXCEPTION 'Leaves me EndDate < StartDate row hai — manually fix karo';
    END IF;
END $$;

-- ---- 4. Constraints -----------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_leaves_status') THEN
        ALTER TABLE "Leaves"
            ADD CONSTRAINT "ck_leaves_status"
            CHECK ("Status" IN ('Pending', 'Approved', 'Rejected', 'Cancelled'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_leaves_dates') THEN
        ALTER TABLE "Leaves"
            ADD CONSTRAINT "ck_leaves_dates"
            CHECK ("EndDate" >= "StartDate");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_leaves_days') THEN
        ALTER TABLE "Leaves"
            ADD CONSTRAINT "ck_leaves_days"
            CHECK ("Days" > 0);
    END IF;

    -- Reject ho hua record me comment hona chahiye (app bhi yehi rule
    -- lagati hai, par DB par bhi rakhna defensive hai).
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_leaves_reject_comment') THEN
        ALTER TABLE "Leaves"
            ADD CONSTRAINT "ck_leaves_reject_comment"
            CHECK ("Status" <> 'Rejected'
                   OR (NULLIF(trim("AdminComment"), '') IS NOT NULL));
    END IF;

    -- Employee delete karte hi uski leaves bhi chale jayein.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leaves_employee') THEN
        ALTER TABLE "Leaves"
            ADD CONSTRAINT "fk_leaves_employee"
            FOREIGN KEY ("EmployeeId") REFERENCES "Employees" ("Id") ON DELETE CASCADE;
    END IF;
END $$;

-- ---- 5. Indexes ---------------------------------------------------------
--  List page ke do hot paths: employee ki history (CreatedDate DESC) aur
--  admin ka "Pending queue" (Status filter). Composite index dono ko
--  sort + filter ek hi scan me de deta hai.

CREATE INDEX IF NOT EXISTS "ix_leaves_employee_created"
    ON "Leaves" ("EmployeeId", "CreatedDate" DESC);

CREATE INDEX IF NOT EXISTS "ix_leaves_status_created"
    ON "Leaves" ("Status", "CreatedDate" DESC);

--  Balance query: ek employee + ek type + ek year ke APPROVED records.

CREATE INDEX IF NOT EXISTS "ix_leaves_employee_type_dates"
    ON "Leaves" ("EmployeeId", "LeaveType", "StartDate")
    WHERE "Status" = 'Approved';

COMMIT;

-- ---- Verify (optional) --------------------------------------------------
--  SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--   WHERE table_name = 'Leaves'
--   ORDER BY ordinal_position;
