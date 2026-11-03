namespace ASPCoreWebAPI.Models
{
    public class WorkLocation
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public int RadiusMeters { get; set; } = 100;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class WorkLocationRequest
    {
        public string? Name { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? RadiusMeters { get; set; }
    }

    public class WorkLocationStatusRequest
    {
        public bool IsActive { get; set; }
    }
}
