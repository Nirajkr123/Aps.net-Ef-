using ASPCoreWebAPI.Models;

namespace ASPCoreWebAPI.Tests.Unit;

public class ShiftTimeTests
{
    [Theory]
    [InlineData(6, 0, 10, 16, 0, false)]
    [InlineData(12, 0, 10, 22, 0, false)]
    [InlineData(20, 0, 10, 6, 0, true)]
    [InlineData(23, 30, 2, 1, 30, true)]
    [InlineData(18, 0, 6, 0, 0, true)]
    [InlineData(0, 0, 23, 23, 0, false)]
    public void CalculateEnd_ComputesEndTimeAndMidnightFlag(
        int startHour,
        int startMinute,
        decimal durationHours,
        int endHour,
        int endMinute,
        bool expectedCrossesMidnight)
    {
        var (end, crossesMidnight) = ShiftTime.CalculateEnd(
            new TimeOnly(startHour, startMinute),
            durationHours);

        Assert.Equal(new TimeOnly(endHour, endMinute), end);
        Assert.Equal(expectedCrossesMidnight, crossesMidnight);
    }

    [Fact]
    public void CalculateEnd_SupportsFractionalDuration()
    {
        var (end, crossesMidnight) = ShiftTime.CalculateEnd(new TimeOnly(6, 0), 10.25m);

        Assert.Equal(new TimeOnly(16, 15), end);
        Assert.False(crossesMidnight);
    }

    [Theory]
    [InlineData("06:00", 6, 0)]
    [InlineData("6:05", 6, 5)]
    [InlineData(" 20:45 ", 20, 45)]
    public void TryParse_AcceptsValidTime(string value, int hour, int minute)
    {
        var parsed = ShiftTime.TryParse(value, out var result);

        Assert.True(parsed);
        Assert.Equal(new TimeOnly(hour, minute), result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("25:00")]
    [InlineData("not-a-time")]
    public void TryParse_RejectsInvalidTime(string? value)
    {
        var parsed = ShiftTime.TryParse(value, out _);

        Assert.False(parsed);
    }

    [Fact]
    public void ToDisplay_ReturnsTwentyFourHourFormat()
    {
        Assert.Equal("06:05", ShiftTime.ToDisplay(new TimeOnly(6, 5)));
    }
}
