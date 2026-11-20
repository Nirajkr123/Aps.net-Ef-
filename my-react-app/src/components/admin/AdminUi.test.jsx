import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
    CountBadge,
    DataTable,
    EmptyState,
    FormDrawer,
    MobileCardList,
    PageHeader,
    Pagination,
    StatCard,
    StatusBadge,
} from "./index";

test("PageHeader renders title, subtitle and accessible actions", () => {
    render(
        <PageHeader
            title="Departments"
            subtitle="Manage organizational departments"
            actions={[{ key: "add", label: "Add Department", onClick: () => {} }]}
        />
    );

    expect(screen.getByRole("heading", { name: "Departments" })).toBeInTheDocument();
    expect(screen.getByText("Manage organizational departments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Department" })).toBeInTheDocument();
});

test("StatCard shows label, value and sublabel", () => {
    render(<StatCard label="Total" value={12} sublabel="All records" />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("All records")).toBeInTheDocument();
});

test("StatusBadge keeps the status as text", () => {
    const { rerender } = render(<StatusBadge status="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();

    rerender(<StatusBadge status="Inactive" />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
});

test("CountBadge renders value with a label", () => {
    render(<CountBadge value={5} label="employees" />);
    expect(screen.getByText("5 employees")).toBeInTheDocument();
});

test("DataTable renders rows and empty state", () => {
    const columns = [{ key: "name", header: "Name" }];
    const { rerender } = render(
        <DataTable ariaLabel="Sample" columns={columns} rows={[{ id: 1, name: "Engineering" }]} rowKey="id" />
    );

    expect(screen.getByText("Engineering")).toBeInTheDocument();

    rerender(
        <DataTable
            ariaLabel="Sample"
            columns={columns}
            rows={[]}
            rowKey="id"
            empty={<EmptyState title="Koi record nahi mila." />}
        />
    );

    expect(screen.getByText("Koi record nahi mila.")).toBeInTheDocument();
});

test("Pagination shows range and fires page change", () => {
    const onPageChange = jest.fn();
    render(<Pagination page={0} pageSize={10} total={25} onPageChange={onPageChange} />);

    expect(screen.getByText("Showing 1–10 of 25")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(1);
});

test("FormDrawer opens as an accessible centered dialog", () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn((event) => event.preventDefault());

    render(
        <FormDrawer
            open
            title="Add Department"
            onClose={onClose}
            onSubmit={onSubmit}
            submitLabel="Create department"
        >
            <label htmlFor="department-name">Department name</label>
            <input id="department-name" />
        </FormDrawer>
    );

    expect(screen.getByRole("dialog", { name: "Add Department" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add Department" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create department" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("MobileCardList hides the empty state while loading", () => {
    const { rerender } = render(
        <MobileCardList loading items={[]} empty={<EmptyState title="Koi record nahi mila." />} />
    );

    expect(screen.queryByText("Koi record nahi mila.")).not.toBeInTheDocument();

    rerender(<MobileCardList items={[]} empty={<EmptyState title="Koi record nahi mila." />} />);

    expect(screen.getByText("Koi record nahi mila.")).toBeInTheDocument();
});
