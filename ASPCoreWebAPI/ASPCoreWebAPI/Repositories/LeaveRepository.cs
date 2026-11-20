using ASPCoreWebAPI.Models;
using Dapper;
using Npgsql;

namespace ASPCoreWebAPI.Repositories
{
    public class LeaveRepository : ILeaveRepository
    {
        private readonly NpgsqlDataSource _dataSource;

        public LeaveRepository(NpgsqlDataSource dataSource)
        {
            _dataSource = dataSource;
        }

        /* Select list har jagah same chahiye — `LeaveRow` me jo columns hain
           wo aur na zyada na kam. Isliye ek const me rakha hai, taaki koi
           query bhoolse na chhute (Dapper chup-chaap null de deta hai). */
        private const string SELECT_LEAVE_ROWS = @"
            SELECT l.""Id"",
                   l.""EmployeeId"",
                   l.""LeaveType"",
                   l.""StartDate""::timestamp  AS ""StartDate"",
                   l.""EndDate""::timestamp    AS ""EndDate"",
                   l.""Reason"",
                   l.""Status"",
                   l.""CreatedDate""::timestamp AS ""CreatedDate"",
                   l.""Days"",
                   l.""HalfDay"",
                   COALESCE(lt.is_paid, TRUE) AS ""IsPaid"",
                   l.""ReviewedBy"",
                   l.""ReviewedOn""::timestamp AS ""ReviewedOn"",
                   l.""AdminComment"",
                   u.""FirstName"",
                   u.""LastName"",
                   e.""EmployeeCode"",
                   dep.""Name""      AS ""DepartmentName"",
                   des.""Title""     AS ""DesignationTitle""
              FROM ""Leaves"" l
              LEFT JOIN ""Employees""   e   ON e.""Id"" = l.""EmployeeId""
              LEFT JOIN ""Users""       u   ON u.""Id"" = e.""UserId""
              LEFT JOIN ""Departments"" dep ON dep.""Id"" = e.""DepartmentId""
              LEFT JOIN ""Designations"" des ON des.""Id"" = e.""DesignationId""
              LEFT JOIN leave_types     lt  ON LOWER(lt.name) = LOWER(l.""LeaveType"")";

        // ---------------------------------------------------------------------
        //  Reads
        // ---------------------------------------------------------------------

        public async Task<List<LeaveRow>> GetByEmployeeIdAsync(int employeeId)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<LeaveRow>(
                SELECT_LEAVE_ROWS + @"
                  WHERE l.""EmployeeId"" = @EmployeeId
                  ORDER BY l.""CreatedDate"" DESC, l.""Id"" DESC",
                new { EmployeeId = employeeId });

            return rows.AsList();
        }

        public async Task<List<LeaveRow>> GetAllAsync(LeaveQuery query)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            /* Filters dynamic hain, isiliye Dapper ke dynamic param use karte
               hain. Values PARAMETERIZED rehte hain (string interpolation
               sirf column/operator names ke liye hai — woh code me likhe
               hain, user input nahi), isiliye SQL injection ka koi rasta
               nahi banta. */
            var where = new List<string>();
            var parameters = new DynamicParameters();

            if (!string.IsNullOrWhiteSpace(query.Status))
            {
                where.Add("l.\"Status\" = @Status");
                parameters.Add("Status", query.Status);
            }

            if (!string.IsNullOrWhiteSpace(query.Type))
            {
                where.Add("l.\"LeaveType\" = @Type");
                parameters.Add("Type", query.Type);
            }

            if (query.EmployeeId.HasValue)
            {
                where.Add("l.\"EmployeeId\" = @EmployeeId");
                parameters.Add("EmployeeId", query.EmployeeId.Value);
            }

            /* Search employee ke naam, code, ya email me se kisi par bhi —
               admin list me teeno dekhkar type karte hain. */
            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                where.Add(@"(u.""FirstName"" ILIKE @Search
                         OR u.""LastName""  ILIKE @Search
                         OR (u.""FirstName"" || ' ' || u.""LastName"") ILIKE @Search
                         OR u.""Email"" ILIKE @Search
                         OR e.""EmployeeCode"" ILIKE @Search)");

                /* ILIKE me `%` wrap karna zaroori hai warna 'an' likhte hi
                   har row match ho jayegi. `%` aur `_` ko escape karte hain
                   taaki user likh ke proper literal search kar sake. */
                var term = "%" + EscapeLike(query.Search.Trim()) + "%";
                parameters.Add("Search", term);
            }

            /* Applied-on range — leave kab apply hua, ye filter hai. */
            if (query.From.HasValue)
            {
                where.Add("l.\"CreatedDate\" >= @From");
                parameters.Add("From", query.From.Value.Date);
            }

            if (query.To.HasValue)
            {
                /* `<=` ko agle din midnight par le jaate hain, warna
                   `To` ki date ke andar wale records miss ho jaate. */
                where.Add("l.\"CreatedDate\" < (@To + INTERVAL '1 day')");
                parameters.Add("To", query.To.Value.Date);
            }

            var sql = SELECT_LEAVE_ROWS;
            if (where.Count > 0)
            {
                sql += " WHERE " + string.Join(" AND ", where);
            }

            /* Naya applied sabse upar; same timestamp par id se stable order
               (warna pagination me rows ek doosre ke badle aa jaati hain). */
            sql += " ORDER BY l.\"CreatedDate\" DESC, l.\"Id\" DESC";

            var rows = await connection.QueryAsync<LeaveRow>(sql, parameters);
            return rows.AsList();
        }

        public async Task<LeaveRow?> GetByIdAsync(int id)
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            return await connection.QuerySingleOrDefaultAsync<LeaveRow>(
                SELECT_LEAVE_ROWS + @" WHERE l.""Id"" = @Id",
                new { Id = id });
        }

        public async Task<List<LeaveTypeOption>> GetTypesAsync()
        {
            using var connection = await _dataSource.OpenConnectionAsync();
            var rows = await connection.QueryAsync<LeaveTypeOption>(
                @"SELECT name AS ""Name"", is_paid AS ""IsPaid""
                    FROM leave_types
                   WHERE COALESCE(is_active, TRUE)
                   ORDER BY id");
            return rows.AsList();
        }

        // ---------------------------------------------------------------------
        //  Writes
        // ---------------------------------------------------------------------

        public async Task<Leave> CreateAsync(Leave leave)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            var id = await connection.ExecuteScalarAsync<int>(@"
                INSERT INTO ""Leaves""
                       (""EmployeeId"", ""LeaveType"", ""StartDate"", ""EndDate"",
                        ""Reason"", ""Status"", ""CreatedDate"", ""Days"", ""HalfDay"",
                        ""ReviewedBy"", ""ReviewedOn"", ""AdminComment"")
                VALUES (@EmployeeId, @LeaveType, @StartDate, @EndDate,
                        @Reason, @Status, @CreatedDate, @Days, @HalfDay,
                        NULL, NULL, NULL)
                RETURNING ""Id""",
                new
                {
                    leave.EmployeeId,
                    leave.LeaveType,
                    leave.StartDate,
                    leave.EndDate,
                    leave.Reason,
                    leave.Status,
                    leave.CreatedDate,
                    leave.Days,
                    leave.HalfDay,
                });

            leave.Id = id;
            return leave;
        }

        public async Task<bool> UpdatePendingAsync(
            int id,
            string status,
            string? reviewedBy,
            DateTime? reviewedOn,
            string? adminComment)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            /* `AND "Status" = 'Pending'` — status guard DB par hai, isliye
               do parallel approvals me se sirf ek hi pass hoga. Doosra 0
               rows milega aur controller ko 409 return karega. */
            var affected = await connection.ExecuteAsync(@"
                UPDATE ""Leaves""
                   SET ""Status""       = @Status,
                       ""ReviewedBy""  = @ReviewedBy,
                       ""ReviewedOn""  = @ReviewedOn,
                       ""AdminComment"" = @AdminComment
                 WHERE ""Id"" = @Id
                   AND ""Status"" = 'Pending'",
                new
                {
                    Id = id,
                    Status = status,
                    ReviewedBy = reviewedBy,
                    ReviewedOn = reviewedOn,
                    AdminComment = adminComment,
                });

            return affected > 0;
        }

        // ---------------------------------------------------------------------
        //  Balance
        // ---------------------------------------------------------------------

        public async Task<Dictionary<string, decimal>> GetUsedDaysAsync(int employeeId, int year)
        {
            using var connection = await _dataSource.OpenConnectionAsync();

            /* SUM("Days"), COUNT(*) nahi — ek 9-din ki approved leave 9 ginti
               hai aur half-day 0.5. Unpaid types quota consume nahi karte,
               isiliye join se filter. Saal filter `StartDate` par hai. */
            var rows = await connection.QueryAsync<(string LeaveType, decimal Used)>(@"
                SELECT l.""LeaveType"", COALESCE(SUM(l.""Days""), 0) AS ""Used""
                  FROM ""Leaves"" l
                  JOIN leave_types lt ON LOWER(lt.name) = LOWER(l.""LeaveType"")
                 WHERE l.""EmployeeId"" = @EmployeeId
                   AND l.""Status"" = 'Approved'
                   AND lt.is_paid
                   AND EXTRACT(YEAR FROM l.""StartDate"") = @Year
                 GROUP BY l.""LeaveType""",
                new { EmployeeId = employeeId, Year = year });

            /* Saare types ke liye 0 default — frontend `total - used` karta
               hai, missing key se woh NaN de sakta tha. */
            var result = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            foreach (var type in LeaveQuota.Defaults.Keys)
            {
                result[type] = 0m;
            }

            foreach (var (leaveType, used) in rows)
            {
                result[leaveType] = used;
            }

            return result;
        }

        /* LIKE pattern ke wildcard characters escape karta hai, warna user
           search me `%` likh ke poori table dekh sakta hai. */
        private static string EscapeLike(string value) =>
            value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
    }
}
