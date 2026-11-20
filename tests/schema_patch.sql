-- Additive patch for DapperDemoDb_Test so it matches the live HRMS schema
-- for the modules under test. Safe to re-run. No drops, no data copy.

-- ---------- Missing columns ----------
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Password" text;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "StateId" integer;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "DistrictId" integer;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "FirebaseUid" varchar(128);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "LastIpAddress" varchar(45);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "LastLogin" timestamptz;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "LastLogout" timestamptz;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "LoginCount" integer DEFAULT 0;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Mobile" varchar(20);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "ProfilePicture" varchar(500);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "RegistrationMethod" varchar(20);
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "CreatedDate" timestamptz NOT NULL DEFAULT now();

ALTER TABLE "Departments" ADD COLUMN IF NOT EXISTS "Description" text;
ALTER TABLE "Departments" ADD COLUMN IF NOT EXISTS "Status" varchar(20) DEFAULT 'Active';
ALTER TABLE "Departments" ADD COLUMN IF NOT EXISTS "CreatedDate" timestamp DEFAULT now();

ALTER TABLE "Designations" ADD COLUMN IF NOT EXISTS "DepartmentId" integer;
ALTER TABLE "Designations" ADD COLUMN IF NOT EXISTS "Status" varchar(20) DEFAULT 'Active';
ALTER TABLE "Designations" ADD COLUMN IF NOT EXISTS "CreatedDate" timestamp DEFAULT now();

ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Phone" varchar(20);
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Address" text;
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "DOB" date;
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "EmergencyContact" varchar(200);
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "FatherName" varchar(200);
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "MotherName" varchar(200);
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "Gender" varchar(20);
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "ManagerId" integer;
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "EmploymentType" varchar(20) DEFAULT 'FULL_TIME';
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "JoiningDate" date;
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "ProfileComplete" boolean NOT NULL DEFAULT false;
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "ProfilePhotoUrl" text;
ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "CreatedDate" timestamp DEFAULT now();

-- ---------- Missing enum + tables ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM
            ('CheckIn', 'CheckOut', 'Leave', 'Announcement', 'Payslip', 'Document', 'General');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "States" (
    "Id" SERIAL PRIMARY KEY,
    "Name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "Districts" (
    "Id" SERIAL PRIMARY KEY,
    "StateId" integer NOT NULL,
    "Name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "Documents" (
    "Id" SERIAL PRIMARY KEY,
    "EmployeeId" integer NOT NULL,
    "Type" varchar(50) NOT NULL,
    "FileName" varchar(255) NOT NULL,
    "FilePath" text NOT NULL,
    "UploadedAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Education" (
    "Id" SERIAL PRIMARY KEY,
    "EmployeeId" integer NOT NULL,
    "Level" varchar(50) NOT NULL,
    "Institution" varchar(300),
    "Board" varchar(200),
    "YearOfPassing" integer,
    "Percentage" numeric,
    "CGPA" numeric,
    "DocumentUrl" varchar(500),
    "CreatedDate" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "EmployeeDocuments" (
    "Id" SERIAL PRIMARY KEY,
    "EmployeeId" integer NOT NULL,
    "DocumentType" varchar(50) NOT NULL,
    "DocumentName" varchar(300),
    "DocumentUrl" varchar(500),
    "IsVerified" boolean DEFAULT false,
    "CreatedDate" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_shift_settings (
    employee_id integer PRIMARY KEY REFERENCES "Employees"("Id"),
    shift_start time NOT NULL DEFAULT '09:30:00',
    shift_end time NOT NULL DEFAULT '18:30:00',
    grace_minutes integer NOT NULL DEFAULT 15,
    min_half_day_hrs numeric(4,2) NOT NULL DEFAULT 4.0,
    full_day_hrs numeric(4,2) NOT NULL DEFAULT 8.0
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    employee_id integer REFERENCES "Employees"("Id") ON DELETE SET NULL,
    type notification_type NOT NULL DEFAULT 'General',
    title varchar(150) NOT NULL,
    message varchar(500) NOT NULL,
    link varchar(255),
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS fcm_tokens (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    token varchar(500) NOT NULL UNIQUE,
    user_agent varchar(255),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens (user_id);
