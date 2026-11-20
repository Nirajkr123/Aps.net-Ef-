using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Repositories
{
    public interface IAttendanceStateRepository
    {
        Task<AttendanceShiftSnapshot?> GetShiftForStateAsync(
            int employeeId,
            DateTime today,
            DateTime yesterday,
            DateTime nowLocal,
            int fallbackCheckoutBufferMinutes);

        Task<AttendanceShiftSnapshot?> GetShiftByAssignmentIdAsync(int assignmentId);

        Task<Attendance?> GetAttendanceForStateAsync(
            int employeeId,
            int? shiftAssignmentId,
            DateTime attendanceDate);

        Task<Attendance?> GetOpenAttendanceForEmployeeAsync(int employeeId);

        Task<int> CloseStaleOpenAttendancesAsync(
            int employeeId,
            DateTime currentAttendanceDate,
            DateTime nowLocal,
            DateTime nowUtc,
            int fallbackCheckoutBufferMinutes);

        Task MarkMissedCheckoutAsync(int attendanceId, DateTime nowUtc);

        Task LogWindowWarningAsync(
            int? userId,
            int? attendanceId,
            string action,
            string details,
            string reason);
    }
}
