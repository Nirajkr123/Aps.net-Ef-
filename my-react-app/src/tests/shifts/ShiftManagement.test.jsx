import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ShiftManagement from "../../modules/shift/ShiftManagement";
import shiftService from "../../services/shiftService";

jest.setTimeout(30000);

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../../Admin/Sidebar", () => () => <aside data-testid="sidebar" />);
jest.mock("../../Admin/Navbar", () => () => <nav data-testid="navbar" />);
jest.mock("../../services/shiftService", () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setStatus: jest.fn(),
  },
}));

const shifts = [
  {
    shiftId: 1,
    shiftName: "Morning",
    startTime: "06:00:00",
    endTime: "14:00:00",
    durationHours: 8,
    crossesMidnight: false,
    isActive: true,
  },
  {
    shiftId: 2,
    shiftName: "Second",
    startTime: "14:00:00",
    endTime: "22:00:00",
    durationHours: 8,
    crossesMidnight: false,
    isActive: false,
  },
  {
    shiftId: 3,
    shiftName: "Night",
    startTime: "22:00:00",
    endTime: "06:00:00",
    durationHours: 8,
    crossesMidnight: true,
    isActive: true,
  },
];

const renderPage = () => render(<ShiftManagement />);

describe("ShiftManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "user",
      JSON.stringify({ firstName: "Owner", lastName: "User", role: "OWNER" })
    );
    shiftService.getAll.mockResolvedValue({ data: shifts });
    shiftService.create.mockResolvedValue({ data: {} });
    shiftService.update.mockResolvedValue({ data: {} });
    shiftService.setStatus.mockResolvedValue({ data: {} });
  });

  test("shows catalog counts and filters search results", async () => {
    renderPage();

    expect(await screen.findAllByText("Morning")).not.toHaveLength(0);

    const filters = screen.getByRole("group", { name: "Filter shifts" });
    expect(within(filters).getByRole("button", { name: /All/ })).toHaveTextContent("3");
    expect(within(filters).getByRole("button", { name: /Active/ })).toHaveTextContent("2");
    expect(within(filters).getByRole("button", { name: /Inactive/ })).toHaveTextContent("1");
    expect(within(filters).getByRole("button", { name: /Overnight/ })).toHaveTextContent("1");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search shifts" }), {
      target: { value: "Night" },
    });

    expect(screen.queryAllByText("Morning")).toHaveLength(0);
    expect(screen.getAllByText("Night").length).toBeGreaterThan(0);

    fireEvent.click(within(filters).getByRole("button", { name: /Inactive/ }));
    expect((await screen.findAllByText("Koi shift nahi mili.")).length).toBeGreaterThan(0);
  });

  test("shows an error state and retries loading", async () => {
    shiftService.getAll
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ data: shifts });
    renderPage();

    expect((await screen.findAllByText("Shifts load nahi ho payi.")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);

    expect(await screen.findAllByText("Morning")).not.toHaveLength(0);
    expect(shiftService.getAll).toHaveBeenCalledTimes(2);
  });

  test("renders the empty state when the catalog has no shifts", async () => {
    shiftService.getAll.mockResolvedValue({ data: [] });
    renderPage();

    expect((await screen.findAllByText("Abhi koi shift nahi hai.")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Add Shift" }).length).toBeGreaterThan(0);
  });

  test("moves through catalog pages without losing records", async () => {
    shiftService.getAll.mockResolvedValue({
      data: Array.from({ length: 12 }, (_, index) => ({
        ...shifts[0],
        shiftId: index + 1,
        shiftName: `Catalog Shift ${index + 1}`,
      })),
    });
    renderPage();

    expect(await screen.findAllByText("Catalog Shift 1")).not.toHaveLength(0);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(await screen.findByText("Catalog Shift 11")).toBeInTheDocument();
  });

  test("blocks an empty shift name before calling the API", async () => {
    renderPage();
    await screen.findAllByText("Morning");

    fireEvent.click(screen.getByRole("button", { name: "Add Shift" }));
    fireEvent.change(screen.getByLabelText("Shift name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Create shift" }));

    expect(await screen.findByText("Shift name is required.")).toBeInTheDocument();
    expect(shiftService.create).not.toHaveBeenCalled();
  });

  test("creates a trimmed shift with the live-preview values", async () => {
    shiftService.getAll
      .mockResolvedValueOnce({ data: shifts })
      .mockResolvedValueOnce({ data: [...shifts, { ...shifts[0], shiftId: 4, shiftName: "Early" }] });
    renderPage();
    await screen.findAllByText("Morning");

    fireEvent.click(screen.getByRole("button", { name: "Add Shift" }));
    fireEvent.change(screen.getByLabelText("Shift name"), {
      target: { value: "  Early  " },
    });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "05:30" } });
    fireEvent.change(screen.getByLabelText("Duration (hours)"), { target: { value: "8.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shift" }));

    await waitFor(() =>
      expect(shiftService.create).toHaveBeenCalledWith({
        shiftName: "Early",
        startTime: "05:30",
        durationHours: 8.5,
        isActive: true,
      })
    );
    expect(await screen.findAllByText("Early")).not.toHaveLength(0);
  });

  test("prefills edit values and sends the selected shift id", async () => {
    renderPage();
    await screen.findAllByText("Morning");

    fireEvent.click(screen.getAllByRole("button", { name: "Edit Morning" })[0]);
    expect(screen.getByLabelText("Shift name")).toHaveValue("Morning");
    expect(screen.getByLabelText("Start time")).toHaveValue("06:00");

    fireEvent.change(screen.getByLabelText("Shift name"), {
      target: { value: "Morning Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update shift" }));

    await waitFor(() =>
      expect(shiftService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ shiftName: "Morning Updated" })
      )
    );
  });

  test("disables the form while saving to prevent a double submit", async () => {
    let resolveCreate;
    shiftService.create.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; })
    );
    renderPage();
    await screen.findAllByText("Morning");

    fireEvent.click(screen.getByRole("button", { name: "Add Shift" }));
    fireEvent.change(screen.getByLabelText("Shift name"), { target: { value: "New Shift" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shift" }));

    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(shiftService.create).toHaveBeenCalledTimes(1);
    resolveCreate({ data: {} });
    await waitFor(() => expect(shiftService.getAll).toHaveBeenCalledTimes(2));
  });

  test("updates active status and reports API errors without changing the row", async () => {
    shiftService.setStatus.mockRejectedValue({
      response: { data: { message: "Status update blocked" } },
    });
    renderPage();
    await screen.findAllByText("Morning");

    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate Morning" })[0]);

    expect(await screen.findByText("Status update blocked")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Deactivate Morning" }).length).toBeGreaterThan(0);
  });
});
