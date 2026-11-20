namespace ASPCoreWebAPI.Services
{
    public static class Money
    {
        public const int Decimals = 2;

        public static decimal Round(decimal value)
        {
            var rounded = Math.Round(value, Decimals, MidpointRounding.AwayFromZero);
            return rounded == 0m ? 0m : rounded;
        }

        public static decimal PercentOf(decimal amount, decimal percent) =>
            Round(amount * percent / 100m);
    }
}
