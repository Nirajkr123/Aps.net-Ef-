-- Deterministic seed for DapperDemoDb_Test (module test run).
-- Re-runnable: truncates only test data, then inserts fixed IDs.
SET TIME ZONE 'Asia/Kolkata';

TRUNCATE TABLE
    notifications,
    fcm_tokens,
    employee_shift_settings,
    "EmployeeDocuments",
    "Education",
    "Documents",
    "Districts",
    "States",
    "Leaves",
    payroll_jobs,
    payslip_adjustments,
    payslips,
    payroll_runs,
    payroll_holidays,
    payroll_week_off_days,
    deduction_rules,
    salary_structures,
    audit_logs,
    attendance_regularization,
    duty_plan_audit,
    duty_plan_segment,
    duty_plan,
    attendance,
    "shift_assignment",
    "assignment_batch",
    "shift",
    "WorkLocations",
    "Employees",
    "Users",
    "Departments",
    "Designations",
    attendance_config,
    test_fail_emp
RESTART IDENTITY CASCADE;

-- ---------- Attendance policy ----------
INSERT INTO attendance_config
    (effective_from, standard_hours, max_hours_per_day, min_gap_same_day_minutes,
     min_rest_normal_minutes, rest_after_extended_minutes, max_extended_per_week,
     punch_early_minutes, punch_late_minutes, late_grace_minutes,
     unpaid_break_minutes, overtime_multiplier, checkout_buffer_minutes,
     half_day_min_hours, full_day_min_hours, timezone_id, enforcement_mode,
     missed_checkout_counts_as_present)
VALUES
    (DATE '2000-01-01', 10, 20, 240, 480, 480, 3, 30, 120, 10, 0, 1.50,
     240, 4, 8, 'Asia/Kolkata', 'WARN', TRUE);

-- ---------- Users ----------
INSERT INTO "Users"
    ("Id", "FirstName", "LastName", "Email", "Password", "Role", "Status",
     "Mobile", "CreatedDate", "LoginCount")
VALUES
    (1,  'Owner',   'Admin',  'owner@hrms-test.local', '__PASSWORD_HASH__', 'OWNER',    'Active',   '9000000001', now() - interval '60 days', 0),
    (2,  'Hema',    'Rao',    'hr@hrms-test.local',    '__PASSWORD_HASH__', 'HR',       'Active',   '9000000002', now() - interval '50 days', 0),
    (3,  'Harsh',   'Rao',    'hr2@hrms-test.local',   '__PASSWORD_HASH__', 'HR',       'Inactive', '9000000003', now() - interval '49 days', 0),
    (10, 'Mohan',   'Manager','mgr@hrms-test.local',   '__PASSWORD_HASH__', 'EMPLOYEE', 'Active',   '9000000010', now() - interval '40 days', 0),
    (11, 'Ram',     'Kumar',  'emp1@hrms-test.local',  '__PASSWORD_HASH__', 'EMPLOYEE', 'Active',   '9000000011', now() - interval '30 days', 0),
    (12, 'Shyam',   'Verma',  'emp2@hrms-test.local',  '__PASSWORD_HASH__', 'EMPLOYEE', 'Active',   '9000000012', now() - interval '30 days', 0),
    (13, 'Mohan',   'Lal',    'emp3@hrms-test.local',  '__PASSWORD_HASH__', 'EMPLOYEE', 'Active',   '9000000013', now() - interval '30 days', 0),
    (14, 'Naya',    'Join',   'emp4@hrms-test.local',  '__PASSWORD_HASH__', 'EMPLOYEE', 'Active',   '9000000014', now(), 0),
    (15, 'Inactive','User',   'emp5@hrms-test.local',  '__PASSWORD_HASH__', 'EMPLOYEE', 'Inactive', '9000000015', now() - interval '20 days', 0);

-- ---------- Departments / Designations ----------
INSERT INTO "Departments" ("Id", "Name", "Description", "Status", "CreatedDate")
VALUES
    (1, 'Engineering', 'Product engineering', 'Active',   now() - interval '90 days'),
    (2, 'Human Resources', 'People operations', 'Active', now() - interval '90 days'),
    (3, 'Operations', 'Field operations', 'Inactive',   now() - interval '90 days');

INSERT INTO "Designations" ("Id", "Title", "DepartmentId", "Status", "CreatedDate")
VALUES
    (1, 'Software Engineer', 1, 'Active', now() - interval '90 days'),
    (2, 'HR Executive',      2, 'Active', now() - interval '90 days'),
    (3, 'Operator',          3, 'Active', now() - interval '90 days');

-- ---------- Employees ----------
INSERT INTO "Employees"
    ("Id", "UserId", "EmployeeCode", "Status", "DepartmentName", "DepartmentId",
     "DesignationId", "DesignationTitle", "Phone", "Address", "EmergencyContact",
     "FatherName", "MotherName", "Gender", "ManagerId", "EmploymentType",
     "JoiningDate", "ProfileComplete", "CreatedDate")
VALUES
    (101, 10, 'EMP-101', 'Active',   'Engineering',     1, 1, 'Software Engineer', '9000000010', 'Delhi',   '9000000091', 'Father 101', 'Mother 101', 'Male',   NULL, 'FULL_TIME', DATE '2023-01-01', TRUE,  now() - interval '40 days'),
    (102, 11, 'EMP-102', 'Active',   'Engineering',     1, 1, 'Software Engineer', '9000000011', 'Noida',   '9000000092', 'Father 102', 'Mother 102', 'Male',   101,  'FULL_TIME', DATE '2024-01-01', TRUE,  now() - interval '30 days'),
    (103, 12, 'EMP-103', 'Active',   'Engineering',     1, 1, 'Software Engineer', '9000000012', 'Gurgaon', '9000000093', 'Father 103', 'Mother 103', 'Male',   101,  'FULL_TIME', DATE '2024-01-01', TRUE,  now() - interval '30 days'),
    (104, 13, 'EMP-104', 'Active',   'Human Resources', 2, 2, 'HR Executive',      '9000000013', 'Delhi',   '9000000094', 'Father 104', 'Mother 104', 'Female', 101,  'FULL_TIME', DATE '2024-01-01', TRUE,  now() - interval '30 days'),
    (105, 14, 'EMP-105', 'Active',   'Engineering',     1, 1, 'Software Engineer', '9000000014', 'Delhi',   '9000000095', 'Father 105', 'Mother 105', 'Male',   101,  'FULL_TIME', CURRENT_DATE,       FALSE, now()),
    (106, 15, 'EMP-106', 'Inactive', 'Engineering',     1, 1, 'Software Engineer', '9000000015', 'Delhi',   '9000000096', 'Father 106', 'Mother 106', 'Male',   101,  'FULL_TIME', DATE '2024-01-01', TRUE,  now() - interval '20 days');

-- ---------- Work locations ----------
INSERT INTO "WorkLocations" ("Id", "Name", "Latitude", "Longitude", "RadiusMeters", "IsActive")
VALUES
    (1, 'Head Office', 28.6139, 77.2090, 100, TRUE),
    (2, 'Old Office',  28.5000, 77.1000, 50,  FALSE);

-- ---------- Shifts + assignments ----------
INSERT INTO "shift"
    ("shift_id", "shift_name", "start_time", "duration_hours", "end_time",
     "crosses_midnight", "is_active", "early_checkin_minutes", "grace_minutes",
     "late_limit_minutes", "checkout_buffer_minutes")
VALUES
    (1, 'Morning', TIME '06:00', 8, TIME '14:00', FALSE, TRUE, 60, 10, 120, 240),
    (2, 'Second',  TIME '14:00', 8, TIME '22:00', FALSE, TRUE, 60, 10, 120, 240),
    (3, 'Night',   TIME '22:00', 8, TIME '06:00', TRUE,  TRUE, 60, 10, 120, 240);

INSERT INTO "shift_assignment"
    ("id", "batch_id", "emp_id", "shift_id", "plan_id", "seq_no",
     "shift_date", "shift_start_dt", "shift_end_dt", "status")
VALUES
    (1, NULL, 102, 1, NULL, NULL, CURRENT_DATE,
     CURRENT_DATE + TIME '06:00', CURRENT_DATE + TIME '14:00', 'Assigned'),
    (2, NULL, 103, 3, NULL, NULL, CURRENT_DATE,
     CURRENT_DATE + TIME '22:00', CURRENT_DATE + INTERVAL '1 day' + TIME '06:00', 'Assigned');

-- ---------- Leave balances snapshots (Leaves table) ----------
-- EMP-104 (Mohan) approved leave today; EMP-102 pending future leave.
INSERT INTO "Leaves"
    ("Id", "EmployeeId", "LeaveType", "StartDate", "EndDate", "Reason",
     "Status", "CreatedDate", "Days", "ReviewedBy", "ReviewedOn", "AdminComment")
VALUES
    (1, 104, 'Casual', CURRENT_DATE, CURRENT_DATE,
     'Family function at home', 'Approved', now() - interval '2 days', 1,
     'Hema Rao', now() - interval '1 day', 'Approved'),
    (2, 102, 'Sick', CURRENT_DATE + 5, CURRENT_DATE + 6,
     'Medical appointment follow up', 'Pending', now() - interval '1 day', 2,
     NULL, NULL, NULL),
    (3, 103, 'Earned', CURRENT_DATE + 10, CURRENT_DATE + 10,
     'Personal errand planned', 'Rejected', now() - interval '3 days', 1,
     'Hema Rao', now() - interval '2 days', 'Peak delivery week');

-- ---------- Attendance history ----------
INSERT INTO attendance
    (employee_id, attendance_date, check_in_time, check_out_time, working_hours,
     status, is_late, location, source)
VALUES
    (102, CURRENT_DATE - 1, (CURRENT_DATE - 1) + TIME '09:05',
     (CURRENT_DATE - 1) + TIME '18:10', 9.08, 'Present', TRUE, 'Head Office', 'SELF'),
    (103, CURRENT_DATE - 1, (CURRENT_DATE - 1) + TIME '22:02', NULL, NULL,
     'MissingPunch', FALSE, 'Head Office', 'SELF'),
    (104, CURRENT_DATE, NULL, NULL, NULL, 'Leave', FALSE, NULL, 'SELF');

-- ---------- Payroll setup ----------
INSERT INTO salary_structures (employee_id, basic, hra, allowances, effective_from, created_by)
VALUES
    (102, 25000, 10000, 3000, DATE '2020-01-01', 1),
    (103, 25000, 10000, 3000, DATE '2020-01-01', 1),
    (104, 25000, 10000, 3000, DATE '2020-01-01', 1),
    (105, 25000, 10000, 3000, DATE '2020-01-01', 1);

INSERT INTO deduction_rules (name, type, value, is_active)
VALUES
    ('PF',  'PERCENT_OF_BASIC', 12,  TRUE),
    ('ESI', 'PERCENT_OF_GROSS', 0.75, TRUE),
    ('PT',  'FIXED',            200, TRUE);

INSERT INTO payroll_week_off_days (day_of_week) VALUES (0);

INSERT INTO payroll_holidays (holiday_date, name, created_by)
VALUES ((date_trunc('month', CURRENT_DATE) - interval '1 month')::date + 14, 'Test Holiday', 1);

INSERT INTO payroll_runs
    ("id", "month", "year", "status", "created_by", "created_at")
VALUES
    (1,
     EXTRACT(MONTH FROM (date_trunc('month', CURRENT_DATE) - interval '2 month'))::smallint,
     EXTRACT(YEAR  FROM (date_trunc('month', CURRENT_DATE) - interval '2 month'))::int,
     'PUBLISHED', 1, now() - interval '60 days'),
    (2,
     EXTRACT(MONTH FROM (date_trunc('month', CURRENT_DATE) - interval '1 month'))::smallint,
     EXTRACT(YEAR  FROM (date_trunc('month', CURRENT_DATE) - interval '1 month'))::int,
     'DRAFT', 1, now() - interval '30 days');

INSERT INTO payslips
    ("id", "run_id", "employee_id", "version", "gross", "lop_days", "lop_amount",
     "adjustments", "total_deductions", "net_pay", "items", "warnings", "status", "pdf_path")
VALUES
    (1, 1, 102, 1, 38000, 0, 0, 0, 3485, 34515,
     '[{"label":"Basic","amount":25000},{"label":"HRA","amount":10000},{"label":"Allowances","amount":3000},{"label":"PF","amount":3000},{"label":"ESI","amount":285},{"label":"PT","amount":200}]'::jsonb,
     '[]'::jsonb, 'PUBLISHED', NULL),
    (2, 1, 103, 1, 38000, 0, 0, 0, 3485, 34515,
     '[{"label":"Basic","amount":25000},{"label":"HRA","amount":10000},{"label":"Allowances","amount":3000},{"label":"PF","amount":3000},{"label":"ESI","amount":285},{"label":"PT","amount":200}]'::jsonb,
     '[]'::jsonb, 'PUBLISHED', NULL),
    (3, 2, 102, 1, 38000, 2, 2533.33, 0, 3485, 31981.67,
     '[{"label":"Basic","amount":25000},{"label":"HRA","amount":10000},{"label":"Allowances","amount":3000},{"label":"LOP","amount":2533.33},{"label":"PF","amount":3000},{"label":"ESI","amount":285},{"label":"PT","amount":200}]'::jsonb,
     '[]'::jsonb, 'DRAFT', NULL),
    (4, 2, 103, 1, 38000, 2, 2533.33, 0, 3485, 31981.67,
     '[{"label":"Basic","amount":25000},{"label":"HRA","amount":10000},{"label":"Allowances","amount":3000},{"label":"LOP","amount":2533.33},{"label":"PF","amount":3000},{"label":"ESI","amount":285},{"label":"PT","amount":200}]'::jsonb,
     '[]'::jsonb, 'DRAFT', NULL);

-- ---------- Sequences ----------
SELECT setval(pg_get_serial_sequence('"Users"', 'Id'), (SELECT MAX("Id") FROM "Users"), TRUE);
SELECT setval(pg_get_serial_sequence('"Employees"', 'Id'), (SELECT MAX("Id") FROM "Employees"), TRUE);
SELECT setval(pg_get_serial_sequence('"Departments"', 'Id'), (SELECT MAX("Id") FROM "Departments"), TRUE);
SELECT setval(pg_get_serial_sequence('"Designations"', 'Id'), (SELECT MAX("Id") FROM "Designations"), TRUE);
SELECT setval(pg_get_serial_sequence('"WorkLocations"', 'Id'), (SELECT MAX("Id") FROM "WorkLocations"), TRUE);
SELECT setval(pg_get_serial_sequence('"Leaves"', 'Id'), (SELECT MAX("Id") FROM "Leaves"), TRUE);
SELECT setval(pg_get_serial_sequence('shift', 'shift_id'), (SELECT MAX(shift_id) FROM shift), TRUE);
SELECT setval(pg_get_serial_sequence('shift_assignment', 'id'), (SELECT MAX(id) FROM shift_assignment), TRUE);
SELECT setval(pg_get_serial_sequence('payroll_runs', 'id'), (SELECT MAX(id) FROM payroll_runs), TRUE);
SELECT setval(pg_get_serial_sequence('payslips', 'id'), (SELECT MAX(id) FROM payslips), TRUE);
SELECT setval(pg_get_serial_sequence('attendance', 'id'), COALESCE((SELECT MAX(id) FROM attendance), 1), TRUE);
