import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import ShiftAssign from "../../modules/shift/ShiftAssign";
import employeeService from "../../services/employeeService";
import shiftService from "../../services/shiftService";

jest.setTimeout(30000);

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../../Admin/Sidebar", () => () => <aside data-testid="sidebar" />);
jest.mock("../../Admin/Navbar", () => () => <nav data-testid="navbar" />);
jest.mock("../../services/employeeService", () => ({
  __esModule: true,
  default: { getAll: jest.fn() },
}));
jest.mock("../../services/shiftService", () => ({
  __esModule: true,
  default: {
    getActive: jest.fn(),
    getAssignments: jest.fn(),
    assign: jest.fn(),
    removeAssignment: jest.fn(),
  },
}));

const activeShifts = [
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
    shiftId: 3,
    shiftName: "Night",
    startTime: "22:00:00",
    endTime: "06:00:00",
    durationHours: 8,
    crossesMidnight: true,
    isActive: true,
  },
];

const employees = [
  {
    id: 101,
    firstName: "Ram",
    lastName: "Kumar",
    employeeCode: "EMP-101",
    departmentName: "Operations",
    shiftName: "Morning",
  },
  {
    id: 102,
    firstName: "Mohan",
    lastName: "Singh",
    employeeCode: "EMP-102",
    departmentName: "Security",
  },
];

const logRow = {
  batchId: 9,
  empId: 101,
  employeeName: "Ram Kumar",
  employeeCode: "EMP-101",
  departmentName: "Operations",
  shiftId: 1,
  shiftName: "Morning",
  startTime: "06:00:00",
  endTime: "14:00:00",
  durationHours: 8,
  fromDate: "2026-11-18",
  toDate: "2026-11-20",
  workDescription: "Morning coverage",
  status: "Active",
  createdByName: "Owner",
  createdByRole: "OWNER",
  createdAt: "2026-11-18T09:30:00",
};

const renderPage = () => render(<ShiftAssign />);

describe("ShiftAssign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      "user",
      JSON.stringify({ role: "OWNER", firstName: "Owner" })
    );
    shiftService.getActive.mockResolvedValue({ data: activeShifts });
    shiftService.getAssignments.mockResolvedValue({ data: [] });
    shiftService.assign.mockResolvedValue({
      data: { batchId: 10, message: "Shift assigned successfully." },
    });
    shiftService.removeAssignment.mockResolvedValue({
      data: { message: "Assignment removed." },
    });
    employeeService.getAll.mockResolvedValue({ data: employees });
  });

  test("loads active shifts, employees, and the assignment audit", async () => {
    shiftService.getAssignments.mockResolvedValue({ data: [logRow] });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Shift Assign" })
    ).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Morning coverage")).toBeInTheDocument();
    expect(within(table).getByText("Owner")).toBeInTheDocument();
    expect(shiftService.getActive).toHaveBeenCalledTimes(1);
    expect(shiftService.getAssignments).toHaveBeenCalledTimes(1);
    expect(employeeService.getAll).toHaveBeenCalledWith({ status: "Active" });
  });

  test("validates shift selection and submits the chosen employees", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Shift Assign" });

    fireEvent.click(screen.getByRole("button", { name: "Assign Shift" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Assign Shift" })
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Ram Kumar/ }));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Assign shift" })
    );
    expect(
      await within(dialog).findByText("Please select a shift.")
    ).toBeInTheDocument();
    expect(shiftService.assign).not.toHaveBeenCalled();

    const shiftPicker = within(dialog).getByRole("group", {
      name: "Select a shift",
    });
    fireEvent.click(within(shiftPicker).getByRole("button", { name: /Morning/ }));
    fireEvent.change(within(dialog).getByLabelText("Work description"), {
      target: { value: "  Morning coverage  " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Assign shift" })
    );

    await waitFor(() =>
      expect(shiftService.assign).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: 1,
          employeeIds: [101],
          workDescription: "Morning coverage",
        })
      )
    );
    expect(shiftService.getAssignments).toHaveBeenCalledTimes(2);
  });

  test("shows API conflict details and keeps the dialog open", async () => {
    shiftService.assign.mockRejectedValue({
      response: {
        status: 409,
        data: {
          message: "Assignment overlaps",
          conflicts: [
            {
              empId: 101,
              employeeName: "Ram Kumar",
              date: "2026-11-18",
              existingShift: "Night",
            },
          ],
        },
      },
    });
    renderPage();
    await screen.findByRole("heading", { name: "Shift Assign" });

    fireEvent.click(screen.getByRole("button", { name: "Assign Shift" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Ram Kumar/ }));
    const shiftPicker = within(dialog).getByRole("group", {
      name: "Select a shift",
    });
    fireEvent.click(within(shiftPicker).getByRole("button", { name: /Morning/ }));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Assign shift" })
    );

    expect(
      await within(dialog).findByText("Assignment overlaps")
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/already on Night/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("removes only the selected employee assignment entry", async () => {
    shiftService.getAssignments.mockResolvedValue({ data: [logRow] });
    renderPage();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Morning coverage")).toBeInTheDocument();

    fireEvent.click(
      within(table).getByRole("button", {
        name: "Delete assignment for Ram Kumar",
      })
    );
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete entry" }));

    await waitFor(() =>
      expect(shiftService.removeAssignment).toHaveBeenCalledWith(9, 101)
    );
  });

  test("renders a stable error state when initial APIs fail", async () => {
    shiftService.getActive.mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText(
        "Could not load shift assignment data. Please try again."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Shift Assign" })
    ).toBeInTheDocument();
  });
});
