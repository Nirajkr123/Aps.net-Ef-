import {
  computeShiftWindow,
  getShiftPalette,
  getTimelineSegments,
  timeText,
} from "../../modules/shift/shiftUi";

describe("shift UI calculations", () => {
  test.each([
    ["06:00", 8, "14:00", false],
    ["14:00", 8, "22:00", false],
    ["22:00", 8, "06:00", true],
    ["06:00", 8.5, "14:30", false],
  ])("computes %s plus %s hours", (start, duration, end, crossesMidnight) => {
    expect(computeShiftWindow(start, duration)).toEqual({
      start,
      end,
      duration,
      crossesMidnight,
    });
  });

  test("splits an overnight shift across the 24-hour timeline", () => {
    expect(getTimelineSegments({ startTime: "22:00", durationHours: 8 })).toEqual([
      { left: (22 / 24) * 100, width: (2 / 24) * 100 },
      { left: 0, width: (6 / 24) * 100 },
    ]);
  });

  test("selects palettes using the shift window", () => {
    expect(getShiftPalette({ startTime: "06:00" }).name).toBe("Morning");
    expect(getShiftPalette({ startTime: "14:00" }).name).toBe("Day");
    expect(getShiftPalette({ startTime: "18:00" }).name).toBe("Night");
    expect(getShiftPalette({ startTime: "10:00", crossesMidnight: true }).name).toBe(
      "Night"
    );
  });

  test("normalizes API time strings for display", () => {
    expect(timeText("06:05:00")).toBe("06:05");
    expect(timeText(null)).toBe("—");
  });
});
