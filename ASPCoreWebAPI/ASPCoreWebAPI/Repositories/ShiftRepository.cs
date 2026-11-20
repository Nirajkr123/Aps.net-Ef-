using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class ShiftRepository : IShiftRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public ShiftRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        private const string BaseSelect = @"
            SELECT shift_id         AS ""ShiftId"",
                   shift_name       AS ""ShiftName"",
                   start_time       AS ""StartTime"",
                   duration_hours   AS ""DurationHours"",
                   end_time         AS ""EndTime"",
                   crosses_midnight AS ""CrossesMidnight"",
                   is_active        AS ""IsActive"",
                   early_checkin_minutes AS ""EarlyCheckinMinutes"",
                   grace_minutes    AS ""GraceMinutes"",
                   late_limit_minutes AS ""LateLimitMinutes"",
                   checkout_buffer_minutes AS ""CheckoutBufferMinutes"",
                   pending_rules::text AS ""PendingRules"",
                   pending_rules_from::timestamp AS ""PendingRulesFrom"",
                   created_at       AS ""CreatedAt"",
                   updated_at       AS ""UpdatedAt""
              FROM ""shift""";

        private const string BatchSelect = @"
            SELECT b.batch_id         AS ""BatchId"",
                   b.shift_id         AS ""ShiftId"",
                   s.shift_name       AS ""ShiftName"",
                   b.from_date::timestamp AS ""FromDate"",
                   b.to_date::timestamp   AS ""ToDate"",
                   b.work_description AS ""WorkDescription"",
                   b.total_employees  AS ""TotalEmployees"",
                   (SELECT COUNT(*)::int
                      FROM ""shift_assignment"" sa
                     WHERE sa.batch_id = b.batch_id AND sa.status = 'Assigned') AS ""AssignmentCount"",
                   b.status           AS ""Status"",
                   b.created_by       AS ""CreatedBy"",
                   COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''), u.""Email"", 'Unknown') AS ""CreatedByName"",
                   b.created_at       AS ""CreatedAt""
              FROM ""assignment_batch"" b
              JOIN ""shift"" s ON s.shift_id = b.shift_id
              LEFT JOIN ""Users"" u ON u.""Id"" = b.created_by";

        private const string ConfigSelect = @"
            SELECT id                            AS ""Id"",
                   effective_from::timestamp     AS ""EffectiveFrom"",
                   standard_hours                AS ""StandardHours"",
                   max_hours_per_day             AS ""MaxHoursPerDay"",
                   min_gap_same_day_minutes      AS ""MinGapSameDayMinutes"",
                   min_rest_normal_minutes       AS ""MinRestNormalMinutes"",
                   rest_after_extended_minutes   AS ""RestAfterExtendedMinutes"",
                   max_extended_per_week         AS ""MaxExtendedPerWeek"",
                   punch_early_minutes           AS ""PunchEarlyMinutes"",
                   punch_late_minutes            AS ""PunchLateMinutes"",
                   late_grace_minutes            AS ""LateGraceMinutes"",
                   unpaid_break_minutes          AS ""UnpaidBreakMinutes"",
                   overtime_multiplier           AS ""OvertimeMultiplier"",
                   checkout_buffer_minutes       AS ""CheckoutBufferMinutes"",
                   half_day_min_hours            AS ""HalfDayMinHours"",
                   full_day_min_hours            AS ""FullDayMinHours"",
                   timezone_id                   AS ""TimezoneId"",
                   enforcement_mode              AS ""EnforcementMode"",
                   missed_checkout_counts_as_present AS ""MissedCheckoutCountsAsPresent"",
                   updated_at                    AS ""UpdatedAt"",
                   updated_by                    AS ""UpdatedBy""
              FROM attendance_config
             ORDER BY effective_from, id";

        public async Task<List<Shift>> GetAllAsync(bool? isActive = null)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var sql = BaseSelect;
            if (isActive.HasValue)
                sql += @" WHERE is_active = @IsActive";
            sql += @" ORDER BY is_active DESC, shift_name";

            var rows = await connection.QueryAsync<Shift>(sql, new { IsActive = isActive });
            return rows.ToList();
        }

        public async Task<Shift?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<Shift>(
                $@"{BaseSelect} WHERE shift_id = @Id", new { Id = id });
        }

        public async Task<bool> NameExistsAsync(string name, int? excludeId = null)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            if (excludeId.HasValue)
            {
                return await connection.ExecuteScalarAsync<bool>(
                    "SELECT COUNT(*) > 0 FROM \"shift\" WHERE LOWER(shift_name) = LOWER(@Name) AND shift_id <> @Id",
                    new { Name = name, Id = excludeId.Value });
            }

            return await connection.ExecuteScalarAsync<bool>(
                "SELECT COUNT(*) > 0 FROM \"shift\" WHERE LOWER(shift_name) = LOWER(@Name)",
                new { Name = name });
        }

        public async Task<Shift> CreateAsync(ShiftRequest request)
        {
            var name = (request.ShiftName ?? string.Empty).Trim();
            if (name.Length == 0)
                throw new InvalidOperationException("Shift name is required.");
            if (name.Length > 100)
                throw new InvalidOperationException("Shift name cannot exceed 100 characters.");

            if (!ShiftTime.TryParse(request.StartTime, out var start))
                throw new InvalidOperationException("Start time is required in HH:mm format.");

            var duration = request.DurationHours ?? 10m;
            if (duration <= 0 || duration >= 24)
                throw new InvalidOperationException("Duration must be greater than 0 and less than 24 hours.");

            if (await NameExistsAsync(name))
                throw new InvalidOperationException("A shift with this name already exists.");

            var (end, crossesMidnight) = ShiftTime.CalculateEnd(start, duration);
            var isActive = request.IsActive ?? true;

            using var connection = await _dataSource.OpenConnectionAsync();
            var id = await connection.ExecuteScalarAsync<int>(
                @"INSERT INTO ""shift""
                      (shift_name, start_time, duration_hours, end_time, crosses_midnight, is_active)
                  VALUES (@ShiftName, @StartTime, @DurationHours, @EndTime, @CrossesMidnight, @IsActive)
                  RETURNING shift_id",
                new
                {
                    ShiftName = name,
                    StartTime = start.ToTimeSpan(),
                    DurationHours = duration,
                    EndTime = end.ToTimeSpan(),
                    CrossesMidnight = crossesMidnight,
                    IsActive = isActive
                });

            return (await GetByIdAsync(id))!;
        }

        public async Task<Shift?> UpdateAsync(int id, ShiftRequest request)
        {
            var existing = await GetByIdAsync(id);
            if (existing == null) return null;

            var name = string.IsNullOrWhiteSpace(request.ShiftName)
                ? existing.ShiftName
                : request.ShiftName.Trim();

            if (name.Length > 100)
                throw new InvalidOperationException("Shift name cannot exceed 100 characters.");

            var start = existing.StartTime;
            if (!string.IsNullOrWhiteSpace(request.StartTime))
            {
                if (!ShiftTime.TryParse(request.StartTime, out start))
                    throw new InvalidOperationException("Start time must be in HH:mm format.");
            }

            var duration = request.DurationHours ?? existing.DurationHours;
            if (duration <= 0 || duration >= 24)
                throw new InvalidOperationException("Duration must be greater than 0 and less than 24 hours.");

            if (await NameExistsAsync(name, id))
                throw new InvalidOperationException("A shift with this name already exists.");

            var (end, crossesMidnight) = ShiftTime.CalculateEnd(start, duration);
            var isActive = request.IsActive ?? existing.IsActive;

            if (string.Equals(name, existing.ShiftName, StringComparison.Ordinal) &&
                start == existing.StartTime &&
                duration == existing.DurationHours &&
                isActive == existing.IsActive)
            {
                return existing;
            }

            using var connection = await _dataSource.OpenConnectionAsync();
            var updated = await connection.ExecuteAsync(
                @"UPDATE ""shift""
                     SET shift_name = @ShiftName,
                         start_time = @StartTime,
                         duration_hours = @DurationHours,
                         end_time = @EndTime,
                         crosses_midnight = @CrossesMidnight,
                         is_active = @IsActive,
                         updated_at = NOW()
                   WHERE shift_id = @Id",
                new
                {
                    Id = id,
                    ShiftName = name,
                    StartTime = start.ToTimeSpan(),
                    DurationHours = duration,
                    EndTime = end.ToTimeSpan(),
                    CrossesMidnight = crossesMidnight,
                    IsActive = isActive
                });

            return updated == 0 ? null : await GetByIdAsync(id);
        }

        public async Task<Shift?> SetActiveAsync(int id, bool isActive)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var updated = await connection.ExecuteAsync(
                @"UPDATE ""shift"" SET is_active = @IsActive, updated_at = NOW() WHERE shift_id = @Id",
                new { Id = id, IsActive = isActive });

            return updated == 0 ? null : await GetByIdAsync(id);
        }

        public async Task<BulkAssignResult> BulkAssignAsync(BulkAssignRequest request, int createdBy)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var context = await PrepareContextAsync(connection, request);

            await using var transaction = await connection.BeginTransactionAsync();
            try
            {
                foreach (var empId in context.EmployeeIds.OrderBy(id => id))
                {
                    await connection.ExecuteAsync(
                        "SELECT pg_advisory_xact_lock(@EmpId::bigint)",
                        new { EmpId = (long)empId },
                        transaction);
                }

                var plan = await BuildPlanAsync(connection, transaction, context);
                var result = new BulkAssignResult
                {
                    SkippedCount = plan.Skipped.Count,
                    Skipped = plan.Skipped
                };

                if (request.Strict && plan.Skipped.Count > 0)
                {
                    result.StrictBlocked = true;
                    result.Message = "Strict mode blocked the save because conflicts were found.";
                    await transaction.RollbackAsync();
                    return result;
                }

                if (plan.Accepted.Count == 0)
                {
                    result.Message = "No assignments saved; all candidates were skipped.";
                    await transaction.RollbackAsync();
                    return result;
                }

                var workDescription = string.IsNullOrWhiteSpace(request.WorkDescription)
                    ? null
                    : request.WorkDescription.Trim();
                var savedEmployees = plan.Accepted.Select(a => a.EmpId).Distinct().Count();

                var batchId = await connection.ExecuteScalarAsync<int>(
                    @"INSERT INTO ""assignment_batch""
                          (shift_id, from_date, to_date, work_description, total_employees, status, created_by)
                      VALUES (@ShiftId, @FromDate::date, @ToDate::date, @WorkDescription, @TotalEmployees, 'Active', @CreatedBy)
                      RETURNING batch_id",
                    new
                    {
                        ShiftId = context.Shift.ShiftId,
                        FromDate = context.From,
                        ToDate = context.To,
                        WorkDescription = workDescription,
                        TotalEmployees = savedEmployees,
                        CreatedBy = createdBy
                    },
                    transaction);

                await connection.ExecuteAsync(
                    @"INSERT INTO ""shift_assignment""
                          (batch_id, emp_id, shift_id, shift_date, shift_start_dt, shift_end_dt, status)
                      SELECT @BatchId, emp_id, @ShiftId, shift_date, start_dt, end_dt, 'Assigned'
                        FROM UNNEST(@EmpIds::int[], @ShiftDates::date[],
                                    @StartDts::timestamp[], @EndDts::timestamp[])
                             AS t(emp_id, shift_date, start_dt, end_dt)",
                    new
                    {
                        BatchId = batchId,
                        ShiftId = context.Shift.ShiftId,
                        EmpIds = plan.Accepted.Select(a => a.EmpId).ToArray(),
                        ShiftDates = plan.Accepted.Select(a => a.ShiftDate).ToArray(),
                        StartDts = plan.Accepted.Select(a => a.StartDt).ToArray(),
                        EndDts = plan.Accepted.Select(a => a.EndDt).ToArray()
                    },
                    transaction);

                await transaction.CommitAsync();

                result.BatchId = batchId;
                result.SavedCount = plan.Accepted.Count;
                result.TotalEmployees = savedEmployees;
                result.TotalAssignments = plan.Accepted.Count;
                result.Message = plan.Skipped.Count == 0
                    ? $"Shift assigned to {savedEmployees} employee(s) for {context.Dates.Count} day(s)."
                    : $"{plan.Accepted.Count} assignment(s) saved, {plan.Skipped.Count} skipped.";

                return result;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<BulkAssignPreviewResult> PreviewBulkAssignAsync(BulkAssignRequest request)
        {
            await using var connection = await _dataSource.OpenConnectionAsync();
            var context = await PrepareContextAsync(connection, request);
            var plan = await BuildPlanAsync(connection, null, context);

            return new BulkAssignPreviewResult
            {
                TotalCandidates = plan.TotalCandidates,
                WouldSaveCount = plan.Accepted.Count,
                WouldSaveEmployeeCount = plan.Accepted.Select(a => a.EmpId).Distinct().Count(),
                SkippedCount = plan.Skipped.Count,
                Skipped = plan.Skipped,
                StrictWouldBlock = request.Strict && plan.Skipped.Count > 0
            };
        }

        private async Task<BulkAssignContext> PrepareContextAsync(
            NpgsqlConnection connection,
            BulkAssignRequest request)
        {
            if (request.ShiftId <= 0)
                throw new InvalidOperationException("Please select a shift.");

            var employeeIds = (request.EmployeeIds ?? new List<int>())
                .Where(id => id > 0)
                .Distinct()
                .ToArray();

            if (employeeIds.Length == 0)
                throw new InvalidOperationException("Please select at least one employee.");
            if (employeeIds.Length > 1000)
                throw new InvalidOperationException("A maximum of 1000 employees can be assigned at once.");

            var from = request.FromDate.Date;
            var to = request.ToDate.Date;
            if (to < from)
                throw new InvalidOperationException("To date cannot be earlier than from date.");

            var dayCount = (to - from).Days + 1;
            if (dayCount > 366)
                throw new InvalidOperationException("Date range cannot exceed 366 days.");

            var shift = await connection.QuerySingleOrDefaultAsync<Shift>(
                $@"{BaseSelect} WHERE shift_id = @Id", new { Id = request.ShiftId });
            if (shift == null)
                throw new InvalidOperationException("Shift not found.");
            if (!shift.IsActive)
                throw new InvalidOperationException("This shift is inactive and cannot be assigned.");

            var existingEmployees = (await connection.QueryAsync<int>(
                @"SELECT ""Id"" FROM ""Employees""
                   WHERE ""Id"" = ANY(@Ids::int[]) AND ""Status"" = 'Active'",
                new { Ids = employeeIds })).ToHashSet();

            var missing = employeeIds.Where(id => !existingEmployees.Contains(id)).ToArray();
            if (missing.Length > 0)
                throw new InvalidOperationException(
                    $"Some selected employees were not found or are inactive: {string.Join(", ", missing)}.");

            var dates = new List<DateTime>();
            for (var date = from; date <= to; date = date.AddDays(1))
                dates.Add(date);

            return new BulkAssignContext
            {
                Shift = shift,
                EmployeeIds = employeeIds,
                From = from,
                To = to,
                Dates = dates
            };
        }

        private async Task<BulkPlan> BuildPlanAsync(
            NpgsqlConnection connection,
            NpgsqlTransaction? transaction,
            BulkAssignContext context)
        {
            var configs = (await connection.QueryAsync<AttendanceConfig>(
                ConfigSelect,
                transaction: transaction)).ToList();

            if (configs.Count == 0)
                throw new InvalidOperationException("Attendance policy configuration is missing.");

            var maxRestMinutes = configs.Max(c =>
                Math.Max(c.MinRestNormalMinutes, c.RestAfterExtendedMinutes));
            var lookbackDays = Math.Max(8, (int)Math.Ceiling(maxRestMinutes / 1440.0) + 2);
            var windowStart = context.From.AddDays(-lookbackDays);
            var windowEnd = context.To.AddDays(lookbackDays + 2);

            var existingDuties = (await connection.QueryAsync<ExistingDuty>(
                @"SELECT sa.id                 AS ""Id"",
                         sa.emp_id             AS ""EmpId"",
                         sa.shift_date::timestamp AS ""ShiftDate"",
                         sa.shift_start_dt     AS ""StartDt"",
                         sa.shift_end_dt       AS ""EndDt"",
                         s.shift_name          AS ""ShiftName"",
                         a.working_hours       AS ""WorkedHours""
                    FROM ""shift_assignment"" sa
                    JOIN ""shift"" s ON s.shift_id = sa.shift_id
                    LEFT JOIN attendance a ON a.shift_assignment_id = sa.id
                   WHERE sa.status = 'Assigned'
                     AND sa.emp_id = ANY(@EmpIds::int[])
                     AND sa.shift_end_dt > @WindowStart
                     AND sa.shift_start_dt < @WindowEnd",
                new
                {
                    EmpIds = context.EmployeeIds,
                    WindowStart = windowStart,
                    WindowEnd = windowEnd
                },
                transaction)).ToList();

            var dutiesByEmployee = context.EmployeeIds
                .ToDictionary(id => id, _ => new List<DutyInterval>());

            foreach (var duty in existingDuties)
            {
                var plannedHours = (decimal)(duty.EndDt - duty.StartDt).TotalHours;
                dutiesByEmployee[duty.EmpId].Add(new DutyInterval
                {
                    EmpId = duty.EmpId,
                    ShiftDate = duty.ShiftDate.Date,
                    StartDt = duty.StartDt,
                    EndDt = duty.EndDt,
                    DurationHours = duty.WorkedHours ?? plannedHours,
                    ShiftName = duty.ShiftName
                });
            }

            var candidates = new List<CandidateDuty>();
            foreach (var date in context.Dates)
            {
                var startDt = DateTime.SpecifyKind(
                    date.Date + context.Shift.StartTime.ToTimeSpan(),
                    DateTimeKind.Unspecified);
                var endDt = startDt.AddHours((double)context.Shift.DurationHours);

                foreach (var empId in context.EmployeeIds)
                {
                    candidates.Add(new CandidateDuty
                    {
                        EmpId = empId,
                        ShiftDate = date.Date,
                        StartDt = startDt,
                        EndDt = endDt,
                        DurationHours = context.Shift.DurationHours,
                        ShiftName = context.Shift.ShiftName
                    });
                }
            }

            candidates.Sort((left, right) =>
            {
                var startComparison = left.StartDt.CompareTo(right.StartDt);
                return startComparison != 0
                    ? startComparison
                    : left.EmpId.CompareTo(right.EmpId);
            });

            var plan = new BulkPlan { TotalCandidates = candidates.Count };

            foreach (var candidate in candidates)
            {
                var config = ResolveConfig(configs, candidate.ShiftDate);
                var duties = dutiesByEmployee[candidate.EmpId];
                var failure = EvaluateCandidate(candidate, duties, config);

                if (failure.HasValue)
                {
                    plan.Skipped.Add(new SkippedAssignment
                    {
                        EmpId = candidate.EmpId,
                        Date = candidate.ShiftDate,
                        Reason = failure.Value.Reason,
                        Detail = failure.Value.Detail
                    });
                    continue;
                }

                plan.Accepted.Add(candidate);
                duties.Add(new DutyInterval
                {
                    EmpId = candidate.EmpId,
                    ShiftDate = candidate.ShiftDate,
                    StartDt = candidate.StartDt,
                    EndDt = candidate.EndDt,
                    DurationHours = candidate.DurationHours,
                    ShiftName = candidate.ShiftName
                });
            }

            return plan;
        }

        private static (string Reason, string Detail)? EvaluateCandidate(
            CandidateDuty candidate,
            IReadOnlyList<DutyInterval> duties,
            AttendanceConfig config)
        {
            var overlap = duties.FirstOrDefault(duty =>
                duty.StartDt < candidate.EndDt && candidate.StartDt < duty.EndDt);

            if (overlap != null)
            {
                return (
                    ShiftConflictReasons.Overlap,
                    $"Overlaps {overlap.ShiftName} ({overlap.StartDt:yyyy-MM-dd HH:mm} to {overlap.EndDt:yyyy-MM-dd HH:mm}).");
            }

            var previous = duties
                .Where(duty => duty.EndDt <= candidate.StartDt)
                .OrderByDescending(duty => duty.EndDt)
                .FirstOrDefault();

            if (previous != null)
            {
                var required = RequiredRest(previous.DurationHours, config);
                var available = (int)Math.Floor((candidate.StartDt - previous.EndDt).TotalMinutes);

                if (available < required)
                {
                    return (
                        ShiftConflictReasons.RestGap,
                        $"Requires {required} minutes rest after {previous.ShiftName}; available {available} minutes.");
                }
            }

            var next = duties
                .Where(duty => duty.StartDt >= candidate.EndDt)
                .OrderBy(duty => duty.StartDt)
                .FirstOrDefault();

            if (next != null)
            {
                var required = RequiredRest(candidate.DurationHours, config);
                var available = (int)Math.Floor((next.StartDt - candidate.EndDt).TotalMinutes);

                if (available < required)
                {
                    return (
                        ShiftConflictReasons.RestGap,
                        $"Requires {required} minutes rest before {next.ShiftName}; available {available} minutes.");
                }
            }

            foreach (var duty in duties.Where(duty => duty.ShiftDate.Date == candidate.ShiftDate))
            {
                var overlapping = duty.StartDt < candidate.EndDt && candidate.StartDt < duty.EndDt;
                if (overlapping) continue;

                var gap = duty.EndDt <= candidate.StartDt
                    ? (int)Math.Floor((candidate.StartDt - duty.EndDt).TotalMinutes)
                    : (int)Math.Floor((duty.StartDt - candidate.EndDt).TotalMinutes);

                if (gap < config.MinGapSameDayMinutes)
                {
                    return (
                        ShiftConflictReasons.SameDayGap,
                        $"Requires {config.MinGapSameDayMinutes} minutes same-day gap; available {gap} minutes.");
                }
            }

            var dailyHours = duties
                .Where(duty => duty.ShiftDate.Date == candidate.ShiftDate)
                .Sum(duty => duty.DurationHours) + candidate.DurationHours;

            if (dailyHours > config.MaxHoursPerDay)
            {
                return (
                    ShiftConflictReasons.MaxHoursPerDay,
                    $"Daily total would be {dailyHours:0.##} hours; limit {config.MaxHoursPerDay:0.##} hours.");
            }

            if (candidate.DurationHours > config.StandardHours)
            {
                var weekStart = StartOfWeek(candidate.ShiftDate);
                var weekEnd = weekStart.AddDays(7);
                var extendedCount = duties.Count(duty =>
                    duty.ShiftDate >= weekStart
                    && duty.ShiftDate < weekEnd
                    && duty.DurationHours > config.StandardHours) + 1;

                if (extendedCount > config.MaxExtendedPerWeek)
                {
                    return (
                        ShiftConflictReasons.MaxExtendedPerWeek,
                        $"Weekly extended duty count would be {extendedCount}; limit {config.MaxExtendedPerWeek}.");
                }
            }

            return null;
        }

        private static int RequiredRest(decimal durationHours, AttendanceConfig config)
        {
            return durationHours > config.StandardHours
                ? config.RestAfterExtendedMinutes
                : config.MinRestNormalMinutes;
        }

        private static AttendanceConfig ResolveConfig(
            IReadOnlyList<AttendanceConfig> configs,
            DateTime date)
        {
            var effective = configs
                .Where(config => config.EffectiveFrom.Date <= date.Date)
                .OrderByDescending(config => config.EffectiveFrom)
                .ThenByDescending(config => config.Id)
                .FirstOrDefault();

            return effective
                ?? configs.OrderBy(config => config.EffectiveFrom).ThenBy(config => config.Id).First();
        }

        private static DateTime StartOfWeek(DateTime date)
        {
            var offset = ((int)date.DayOfWeek + 6) % 7;
            return date.Date.AddDays(-offset);
        }

        public async Task<List<AssignmentBatch>> GetBatchesAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<AssignmentBatch>(
                $@"{BatchSelect}
                   ORDER BY b.created_at DESC, b.batch_id DESC");
            return rows.ToList();
        }

        public async Task<AssignmentBatch?> GetBatchAsync(int batchId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<AssignmentBatch>(
                $@"{BatchSelect} WHERE b.batch_id = @BatchId", new { BatchId = batchId });
        }

        public async Task<List<ShiftAssignment>> GetBatchAssignmentsAsync(int batchId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<ShiftAssignment>(
                @"SELECT sa.id             AS ""Id"",
                         sa.batch_id       AS ""BatchId"",
                         sa.emp_id         AS ""EmpId"",
                         COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                                  'Unknown') AS ""EmployeeName"",
                         e.""EmployeeCode"" AS ""EmployeeCode"",
                         sa.shift_id       AS ""ShiftId"",
                         s.shift_name      AS ""ShiftName"",
                         sa.plan_id        AS ""PlanId"",
                         sa.seq_no         AS ""SeqNo"",
                         sa.shift_date::timestamp AS ""ShiftDate"",
                         sa.shift_start_dt AS ""ShiftStartDt"",
                         sa.shift_end_dt   AS ""ShiftEndDt"",
                         sa.status         AS ""Status"",
                         sa.created_at     AS ""CreatedAt""
                    FROM ""shift_assignment"" sa
                    JOIN ""Employees"" e ON e.""Id"" = sa.emp_id
                    LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""
                    JOIN ""shift"" s ON s.shift_id = sa.shift_id
                   WHERE sa.batch_id = @BatchId
                   ORDER BY sa.shift_date, u.""FirstName"", u.""LastName""",
                new { BatchId = batchId });
            return rows.ToList();
        }

        public async Task<List<ShiftAssignmentLogRow>> GetAssignmentLogAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<ShiftAssignmentLogRow>(
                @"SELECT b.batch_id         AS ""BatchId"",
                         sa.emp_id          AS ""EmpId"",
                         COALESCE(NULLIF(BTRIM(u.""FirstName"" || ' ' || u.""LastName""), ''),
                                  u.""Email"", 'Unknown') AS ""EmployeeName"",
                         e.""EmployeeCode"" AS ""EmployeeCode"",
                         dep.""Name""        AS ""DepartmentName"",
                         s.shift_id         AS ""ShiftId"",
                         s.shift_name       AS ""ShiftName"",
                         s.start_time       AS ""StartTime"",
                         s.end_time         AS ""EndTime"",
                         s.duration_hours   AS ""DurationHours"",
                         b.from_date::timestamp AS ""FromDate"",
                         b.to_date::timestamp   AS ""ToDate"",
                         b.work_description AS ""WorkDescription"",
                         b.status           AS ""Status"",
                         b.created_by       AS ""CreatedBy"",
                         COALESCE(NULLIF(BTRIM(cu.""FirstName"" || ' ' || cu.""LastName""), ''),
                                  cu.""Email"", 'Unknown') AS ""CreatedByName"",
                         cu.""Role""         AS ""CreatedByRole"",
                         b.created_at       AS ""CreatedAt""
                    FROM ""assignment_batch"" b
                    JOIN ""shift"" s ON s.shift_id = b.shift_id
                    JOIN (
                        SELECT batch_id, emp_id
                          FROM ""shift_assignment""
                         WHERE status = 'Assigned'
                         GROUP BY batch_id, emp_id
                    ) sa ON sa.batch_id = b.batch_id
                    JOIN ""Employees"" e ON e.""Id"" = sa.emp_id
                    LEFT JOIN ""Users"" u ON u.""Id"" = e.""UserId""
                    LEFT JOIN ""Departments"" dep ON dep.""Id"" = e.""DepartmentId""
                    LEFT JOIN ""Users"" cu ON cu.""Id"" = b.created_by
                   ORDER BY b.created_at DESC, b.batch_id DESC, ""EmployeeName""");
            return rows.ToList();
        }

        public async Task<bool> RemoveEmployeeFromBatchAsync(int batchId, int empId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var affected = await connection.ExecuteAsync(
                    @"UPDATE ""shift_assignment""
                         SET status = 'Cancelled'
                       WHERE batch_id = @BatchId
                         AND emp_id = @EmpId
                         AND status = 'Assigned'",
                    new { BatchId = batchId, EmpId = empId },
                    transaction);

                if (affected == 0)
                {
                    await transaction.RollbackAsync();
                    return false;
                }

                /* Batch ka headcount active assignments se hi count hota hai.
                   Aakhri employee nikalne par batch khud bhi cancelled. */
                var remaining = await connection.ExecuteScalarAsync<int>(
                    @"SELECT COUNT(DISTINCT emp_id)::int
                        FROM ""shift_assignment""
                       WHERE batch_id = @BatchId AND status = 'Assigned'",
                    new { BatchId = batchId },
                    transaction);

                await connection.ExecuteAsync(
                    @"UPDATE ""assignment_batch""
                         SET total_employees = @Remaining,
                             status = CASE WHEN @Remaining = 0 THEN 'Cancelled' ELSE status END
                       WHERE batch_id = @BatchId",
                    new { BatchId = batchId, Remaining = remaining },
                    transaction);

                await transaction.CommitAsync();
                return true;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<AssignmentBatch?> CancelBatchAsync(int batchId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            using var transaction = await connection.BeginTransactionAsync();
            try
            {
                var updated = await connection.ExecuteAsync(
                    @"UPDATE ""assignment_batch""
                         SET status = 'Cancelled'
                       WHERE batch_id = @BatchId AND status = 'Active'",
                    new { BatchId = batchId },
                    transaction);

                if (updated == 0)
                {
                    var existing = await GetBatchAsync(batchId);
                    if (existing == null) return null;
                    throw new InvalidOperationException("Assignment batch is already cancelled.");
                }

                await connection.ExecuteAsync(
                    @"UPDATE ""shift_assignment""
                         SET status = 'Cancelled'
                       WHERE batch_id = @BatchId AND status = 'Assigned'",
                    new { BatchId = batchId },
                    transaction);

                await transaction.CommitAsync();
                return await GetBatchAsync(batchId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private sealed class BulkAssignContext
        {
            public Shift Shift { get; set; } = null!;
            public int[] EmployeeIds { get; set; } = Array.Empty<int>();
            public DateTime From { get; set; }
            public DateTime To { get; set; }
            public List<DateTime> Dates { get; set; } = new();
        }

        private sealed class BulkPlan
        {
            public int TotalCandidates { get; set; }
            public List<CandidateDuty> Accepted { get; } = new();
            public List<SkippedAssignment> Skipped { get; } = new();
        }

        private sealed class CandidateDuty
        {
            public int EmpId { get; set; }
            public DateTime ShiftDate { get; set; }
            public DateTime StartDt { get; set; }
            public DateTime EndDt { get; set; }
            public decimal DurationHours { get; set; }
            public string ShiftName { get; set; } = string.Empty;
        }

        private sealed class DutyInterval
        {
            public int EmpId { get; set; }
            public DateTime ShiftDate { get; set; }
            public DateTime StartDt { get; set; }
            public DateTime EndDt { get; set; }
            public decimal DurationHours { get; set; }
            public string ShiftName { get; set; } = string.Empty;
        }

        private sealed class ExistingDuty
        {
            public int Id { get; set; }
            public int EmpId { get; set; }
            public DateTime ShiftDate { get; set; }
            public DateTime StartDt { get; set; }
            public DateTime EndDt { get; set; }
            public string ShiftName { get; set; } = string.Empty;
            public decimal? WorkedHours { get; set; }
        }
    }
}
