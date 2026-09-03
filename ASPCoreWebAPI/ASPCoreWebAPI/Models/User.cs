namespace ASPCoreWebAPI.Models
{
    public class User
    {
        public int Id { get; set; }

        public string FirstName { get; set; } = string.Empty;

        public string LastName { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string Password { get; set; } = string.Empty;

        public string Role { get; set; } = "User";

        public int? StateId { get; set; }

        public int? DistrictId { get; set; }

        public string Status { get; set; } = "Active";

        public DateTime? LastLogin { get; set; }

        public string? StateName { get; set; }

        public string? DistrictName { get; set; }

        public string? FirebaseUid { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
