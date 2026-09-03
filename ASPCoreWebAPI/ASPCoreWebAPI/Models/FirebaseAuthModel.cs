namespace ASPCoreWebAPI.Models
{
    public class FirebaseAuthModel
    {
        public string IdToken { get; set; } = string.Empty;
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
    }
}
