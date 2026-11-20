# Payroll & Payslips

HRMS payroll module for monthly payroll runs, payslip versioning, PDF generation, notifications, and employee self-service downloads.

## Scope

- Admin payroll APIs for `OWNER` and `HR`.
- Employee self-service APIs for the signed-in employee.
- PostgreSQL schema and scripts for payroll configuration and results.
- Background processing for payroll calculation and payslip PDF generation.
- React employee payslip page with authenticated PDF downloads.

## Roles

- `OWNER` and `HR`: manage payroll runs, salary structures, deduction rules, holidays, week-off days, adjustments, approval, and publishing.
- `EMPLOYEE`: view and download only their own published payslips.
- Employee APIs prefer the `employee_id` JWT claim and fall back to a user-to-employee lookup.

## Database

Payroll schema is not applied automatically.

```powershell
psql -h localhost -U postgres -d DapperDemoDb -f ASPCoreWebAPI/ASPCoreWebAPI/scripts/migrate-payroll.sql
```

Optional development seed:

```powershell
psql -h localhost -U postgres -d DapperDemoDb -f ASPCoreWebAPI/ASPCoreWebAPI/scripts/seed-payroll.sql
```

Payroll tables:

- `salary_structures`
- `deduction_rules`
- `payroll_runs`
- `payslips`
- `payslip_adjustments`
- `payroll_holidays`
- `payroll_week_off_days`
- `payroll_jobs`
- `audit_logs`

## Configuration

`ASPCoreWebAPI/ASPCoreWebAPI/appsettings.json`:

- `ConnectionStrings:DefaultConnection`
- `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpireMinutes`
- `Cors:AllowedOrigins`
- `Firebase:ServiceAccountKeyPath`

Do not commit real secrets. Firebase keys and environment-specific appsettings files are ignored.

## Running

Backend:

```powershell
dotnet run --project ASPCoreWebAPI/ASPCoreWebAPI/ASPCoreWebAPI.csproj
```

Frontend:

```powershell
cd my-react-app
npm start
```

Swagger is available in development at `/swagger`.

## Payroll Flow

1. `POST /api/payroll/runs` creates a `DRAFT` run and queues `CALCULATE_RUN`.
2. The background worker calculates payslips from salary structures, attendance, approved leaves, holidays, and week-off days.
3. Admin reviews the run and payslips, optionally adds adjustments and recalculates.
4. `POST /api/payroll/runs/{id}/approve` moves the run to `APPROVED`.
5. `POST /api/payroll/runs/{id}/publish` moves the run and payslips to `PUBLISHED`, then queues `GENERATE_PDF` jobs.
6. The worker generates PDFs under private storage and notifies employees when the latest published PDF is ready.

Statuses:

- Run: `DRAFT` -> `APPROVED` -> `PUBLISHED`
- Payslip: `DRAFT` -> `PUBLISHED`
- Job: `QUEUED` -> `RUNNING` -> `SUCCEEDED` / `RETRYING` / `FAILED`

## Calculation Rules

- Money uses `decimal` and PostgreSQL `NUMERIC(14,2)` with two-decimal rounding.
- PF is calculated as 12% of basic, capped at INR 15,000 basic.
- Missing salary structure produces a zero payslip and a warning.
- Future and duplicate monthly runs are rejected.
- Adjustments are only allowed on draft runs.
- Approval requires no active calculation job and at least one payslip.
- Publishing is allowed only from `APPROVED`.

### Loss of Pay

For each day in the payroll month:

- Dates before joining date or in the future are skipped.
- Weekly off or holiday: `0`.
- Approved leave: `0`.
- Attendance `Absent`: `1`.
- Attendance `Half-day`: `0.5`.
- `Present`, `Late`, `MissingPunch`, `Leave`, `Holiday`: `0`.
- Missing attendance on a working day: `1`.

LOP is clamped to the number of days in the month.

## Admin API

All endpoints require `OWNER` or `HR`.

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/payroll/runs` |
| `GET` | `/api/payroll/runs` |
| `GET` | `/api/payroll/runs/{id}` |
| `GET` | `/api/payroll/runs/{id}/payslips` |
| `GET` | `/api/payroll/runs/{id}/jobs` |
| `POST` | `/api/payroll/runs/{id}/recalculate` |
| `POST` | `/api/payroll/runs/{id}/approve` |
| `POST` | `/api/payroll/runs/{id}/publish` |
| `GET` | `/api/payroll/payslips/{id}` |
| `GET` | `/api/payroll/payslips/{id}/versions` |
| `POST` | `/api/payroll/payslips/{id}/reissue` |
| `POST` | `/api/payroll/payslips/{id}/adjustments` |
| `GET` | `/api/payroll/salary-structures?employeeId=` |
| `POST` | `/api/payroll/salary-structures` |
| `GET` | `/api/payroll/deduction-rules` |
| `POST` | `/api/payroll/deduction-rules` |
| `PUT` | `/api/payroll/deduction-rules/{id}` |
| `GET` | `/api/payroll/holidays?year=` |
| `POST` | `/api/payroll/holidays` |
| `DELETE` | `/api/payroll/holidays/{id}` |
| `GET` | `/api/payroll/week-off-days` |
| `PUT` | `/api/payroll/week-off-days` |

Run payslips support `search`, `status`, `page`, and `pageSize` query parameters.

## Employee API

Employee routes require authentication and return only the current employee's own published payslips.

| Method | Endpoint |
| --- | --- |
| `GET` | `/api/me/payslips?year=2026` |
| `GET` | `/api/me/payslips/latest` |
| `GET` | `/api/me/payslips/{id}` |
| `GET` | `/api/me/payslips/{id}/download` |

Legacy aliases are also available:

- `/api/payslip/my`
- `/api/payslip/latest`
- `/api/payslip/{id}`
- `/api/payslip/download/{id}`

Payslip list endpoints return the latest version only. Detail and download checks enforce ownership and published status.

## Reissue and Versioning

- Only the latest published payslip can be reissued.
- Reissue clones the published snapshot; it does not recalculate.
- The new version is immediately `PUBLISHED` and has no PDF path until the worker generates it.
- Older versions are preserved.
- A reason is required and recorded in the audit log.
- Run summaries and employee lists use the latest version only.

## PDF Storage

- PDFs are stored under `ASPCoreWebAPI/ASPCoreWebAPI/private/payslips/{year}-{month}/`.
- The database stores a relative path.
- Private payslips are not exposed through static file middleware.
- Download endpoints validate that resolved paths stay inside private payslip storage.
- Missing or invalid PDF paths trigger safe regeneration.
- Notifications are sent only after the latest published PDF is generated.
- Back up the `private/` directory in production and restrict filesystem permissions.

## PDFsharp License

The project uses PDFsharp 6.5 with `PdfSharpLicense.SetAgplLicense()`.

This makes the application subject to AGPL-3.0-only obligations when distributed or offered as a network service. Review the license before commercial distribution or replace PDFsharp with a commercially compatible library.

## Frontend

Relevant files:

- `my-react-app/src/services/payslipService.js`
- `my-react-app/src/Employee/EmployeePayslips.jsx`
- `my-react-app/src/Employee/components/PayslipPreview.jsx`

Downloads use Axios with `responseType: "blob"`, so the JWT header is sent before the PDF is saved.

## Tests

Unit tests:

```powershell
dotnet test ASPCoreWebAPI/ASPCoreWebAPI.Tests/ASPCoreWebAPI.Tests.csproj --filter "FullyQualifiedName~ASPCoreWebAPI.Tests.Unit"
```

Payroll and employee API tests:

```powershell
dotnet test ASPCoreWebAPI/ASPCoreWebAPI.Tests/ASPCoreWebAPI.Tests.csproj --filter "FullyQualifiedName~EmployeePayslip|FullyQualifiedName~PayrollSecurity"
```

Frontend production build:

```powershell
cd my-react-app
npm run build
```

Known repository-wide test issue: some pre-existing shift/attendance integration tests fail on PostgreSQL `DATE` to `DateOnly` Dapper mapping. These failures are unrelated to payroll.

## Disclaimer

This module is a software implementation, not legal, tax, or payroll advice. PF, ESI, Professional Tax, TDS, and other statutory rules must be verified by a qualified payroll professional or CA before production use.
