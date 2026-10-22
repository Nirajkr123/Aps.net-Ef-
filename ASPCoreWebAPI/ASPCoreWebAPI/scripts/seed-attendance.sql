-- =====================================================================
--  Demo attendance seed  —  sirf DEVELOPMENT / local testing ke liye
-- =====================================================================
--  Kyu: My Attendance page 180 din ka history fetch karti hai, lekin
--  `attendance` table me sirf 8 rows the. Isliye page 90% khaali
--  dikhti thi (chart me 1 bar, table me 3 rows). Ye script employee
--  ke pichle 90 din ke realistic punch records bana deta hai.
--
--  Safety:
--   · sirf employee_id = 20 (local dev login)
--   · Sunday skip
--   · `ON CONFLICT ON CONSTRAINT uq_employee_date DO NOTHING` —
--     unique index (employee_id, attendance_date) ki wajah se jo
--     din pehle se maujood hai (25/26/27 Sep) wo kabhi overwrite
--     nahi honge
--   · aaj se pehle ke din hi (koi future record nahi)
--
--  ROLLBACK (sab kuch hata dena):
--   DELETE FROM attendance
--    WHERE employee_id = 20
--      AND attendance_date BETWEEN current_date - 90 AND current_date - 1
--      AND attendance_date NOT IN (DATE '2026-09-25', DATE '2026-09-26', DATE '2026-09-27');
--
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/seed-attendance.sql
-- =====================================================================

BEGIN;

WITH days AS (
    SELECT d::date AS attendance_date,
           /* din ka number 1..365 — isse pattern DETERMINISTIC rehta
              hai, har run par same data banta hai */
           EXTRACT(DOY FROM d)::int AS doy
    FROM generate_series(current_date - 90, current_date - 1, interval '1 day') AS d
),
plan AS (
    SELECT attendance_date,
           doy,
           /* Chhoti chutti ka pehla din */
           CASE WHEN doy % 17 = 0 THEN 'Leave'
                /* Absent — koi punch nahi */
                WHEN doy % 13 = 0 THEN 'Absent'
                /* Half day — 4 ghante */
                WHEN doy % 11 = 0 THEN 'Half-day'
                /* Late — 10:15 ke baad aaya */
                WHEN doy % 7  = 0 THEN 'Late'
                ELSE 'Present'
           END AS status
    FROM days
    /* Sunday = weekly off, koi record nahi */
    WHERE EXTRACT(DOW FROM attendance_date) <> 0
),
times AS (
    SELECT p.*,
           /* Check-in: Present 09:00–09:55, Late 10:15–10:45 */
           CASE WHEN p.status = 'Late'
                THEN (DATE '2000-01-01' + time '10:15' + ((p.doy % 4) * interval '10 minutes'))
                WHEN p.status = 'Leave'   THEN NULL
                WHEN p.status = 'Absent'  THEN NULL
                ELSE (DATE '2000-01-01' + time '09:00' + ((p.doy % 5) * interval '12 minutes') + (p.doy % 7) * interval '1 minute')
           END AS in_time,
           CASE WHEN p.status = 'Half-day'
                THEN (DATE '2000-01-01' + time '09:00' + ((p.doy % 5) * interval '12 minutes') + (p.doy % 7) * interval '1 minute') + interval '4 hours'
                WHEN p.status IN ('Leave', 'Absent') THEN NULL
                /* Present/Late: 8h30 se 10h30 ke beech ka duration */
                ELSE (DATE '2000-01-01' + time '09:00' + ((p.doy % 5) * interval '12 minutes') + (p.doy % 7) * interval '1 minute')
                     + interval '8 hours 30 minutes' + ((p.doy % 6) * interval '20 minutes')
           END AS out_time
    FROM plan p
)
INSERT INTO attendance
    (employee_id, attendance_date, check_in_time, check_out_time,
     working_hours, status, is_late, created_at, updated_at)
SELECT 20,
       attendance_date,
       /* `in_time` me sirf time-of-day hai (DATE '2000-01-01' base),
          isse ASLI attendance_date jodte hain — warna timestamp
          2000-01-01 par chala jaata. */
       CASE WHEN in_time IS NULL THEN NULL
            ELSE attendance_date + (in_time - DATE '2000-01-01')
       END,
       CASE WHEN out_time IS NULL THEN NULL
            ELSE attendance_date + (out_time - DATE '2000-01-01')
       END,
       /* ghante me 2 decimal, round off nahi */
       CASE WHEN out_time IS NULL THEN NULL
            ELSE ROUND(EXTRACT(EPOCH FROM (out_time - in_time)) / 3600.0, 2)
       END,
       status::attendance_status,
       (status = 'Late'),
       now(),
       now()
FROM times
ON CONFLICT ON CONSTRAINT uq_employee_date DO NOTHING;

COMMIT;

-- Kitne rows bane — summary
SELECT employee_id,
       COUNT(*)            AS total_rows,
       MIN(attendance_date) AS first_day,
       MAX(attendance_date) AS last_day,
       ROUND(SUM(working_hours), 1) AS total_hours
FROM attendance
WHERE employee_id = 20
GROUP BY employee_id;
