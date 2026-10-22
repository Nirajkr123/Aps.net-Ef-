namespace ASPCoreWebAPI.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int? EmployeeId { get; set; }
        public string Type { get; set; } = "General";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Link { get; set; }
        public bool IsRead { get; set; }
        public DateTime? ReadAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateNotificationDto
    {
        public int UserId { get; set; }
        public int? EmployeeId { get; set; }
        public string Type { get; set; } = "General";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Link { get; set; }
    }

    public class MarkReadRequest
    {
        public int[] Ids { get; set; } = Array.Empty<int>();
    }

    public class RegisterFcmTokenDto
    {
        public string Token { get; set; } = string.Empty;
        public string? UserAgent { get; set; }
    }
}
