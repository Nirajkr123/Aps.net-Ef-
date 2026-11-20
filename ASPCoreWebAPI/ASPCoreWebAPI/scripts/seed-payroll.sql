-- =====================================================================
--  Payroll development seed
-- ---------------------------------------------------------------------
--  DEV ONLY. Do not run on production.
--  Idempotent: existing rows are left untouched.
--
--  Run:
--   psql -h localhost -p 5432 -U postgres -d DapperDemoDb -f scripts/seed-payroll.sql
--
--  DISCLAIMER:
--  PF / ESI / Professional Tax / TDS rules state aur salary ke hisaab se
--  alag hote hain. Ye sirf sample configuration hai; live salary par
--  chalane se pehle CA / payroll expert se verify karwana zaroori hai.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
--  3 dummy users + employees
-- ---------------------------------------------------------------------

INSERT INTO "Users" ("FirstName", "LastName", "Email", "Password", "Role", "Status", "CreatedDate")
SELECT v."FirstName", v."LastName", v."Email", v."Password", v."Role", v."Status", NOW()
FROM (
    VALUES
        ('Payroll', 'Alpha', 'payroll.alpha@example.com', 'dev-seed-no-login', 'EMPLOYEE', 'Active'),
        ('Payroll', 'Beta',  'payroll.beta@example.com',  'dev-seed-no-login', 'EMPLOYEE', 'Active'),
        ('Payroll', 'Gamma', 'payroll.gamma@example.com', 'dev-seed-no-login', 'EMPLOYEE', 'Active')
) AS v("FirstName", "LastName", "Email", "Password", "Role", "Status")
WHERE NOT EXISTS (
    SELECT 1 FROM "Users" u WHERE lower(u."Email") = lower(v."Email")
);

INSERT INTO "Employees" ("UserId", "EmployeeCode", "EmploymentType", "JoiningDate", "ProfileComplete", "Status", "CreatedDate")
SELECT u."Id", v."EmployeeCode", 'FULL_TIME', CURRENT_DATE - INTERVAL '2 years', TRUE, 'Active', NOW()
FROM (
    VALUES
        ('payroll.alpha@example.com', 'PAY-EMP-001'),
        ('payroll.beta@example.com',  'PAY-EMP-002'),
        ('payroll.gamma@example.com', 'PAY-EMP-003')
) AS v("Email", "EmployeeCode")
JOIN "Users" u ON lower(u."Email") = lower(v."Email")
WHERE NOT EXISTS (
    SELECT 1 FROM "Employees" e WHERE e."EmployeeCode" = v."EmployeeCode"
);

-- ---------------------------------------------------------------------
--  Salary structures (gross 38000 for Alpha, 52000 for Beta, 31000 for Gamma)
-- ---------------------------------------------------------------------

INSERT INTO salary_structures (employee_id, basic, hra, allowances, effective_from, created_by)
SELECT e."Id", v.basic, v.hra, v.allowances, DATE '2020-01-01', NULL
FROM (
    VALUES
        ('PAY-EMP-001', 25000.00, 10000.00, 3000.00),
        ('PAY-EMP-002', 34000.00, 14000.00, 4000.00),
        ('PAY-EMP-003', 20000.00, 8000.00,  3000.00)
) AS v("EmployeeCode", basic, hra, allowances)
JOIN "Employees" e ON e."EmployeeCode" = v."EmployeeCode"
WHERE NOT EXISTS (
    SELECT 1
    FROM salary_structures s
    WHERE s.employee_id = e."Id"
      AND s.effective_from = DATE '2020-01-01'
);

-- ---------------------------------------------------------------------
--  Deduction rules (configurable)
-- ---------------------------------------------------------------------

INSERT INTO deduction_rules (name, type, value, is_active)
SELECT v.name, v.type, v.value, TRUE
FROM (
    VALUES
        ('Provident Fund', 'PERCENT_OF_BASIC', 12.0000),
        ('Professional Tax', 'FIXED', 200.0000)
) AS v(name, type, value)
WHERE NOT EXISTS (
    SELECT 1 FROM deduction_rules d WHERE lower(d.name) = lower(v.name)
);

-- ---------------------------------------------------------------------
--  Calendar sample
-- ---------------------------------------------------------------------

INSERT INTO payroll_holidays (holiday_date, name)
VALUES
    (make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 26), 'Republic Day'),
    (make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 8, 15), 'Independence Day')
ON CONFLICT (holiday_date) DO NOTHING;

INSERT INTO payroll_week_off_days (day_of_week)
VALUES (0)
ON CONFLICT (day_of_week) DO NOTHING;

COMMIT;
