namespace ASPCoreWebAPI.Models
{
    public class AuditLog
    {
        public long Id { get; set; }
        public int? UserId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string Entity { get; set; } = string.Empty;
        public long? EntityId { get; set; }
        public string Details { get; set; } = "{}";
        public DateTime At { get; set; }
    }
}
