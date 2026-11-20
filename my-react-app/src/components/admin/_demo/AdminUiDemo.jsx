import React, { useState } from "react";
import { TextField } from "@mui/material";
import {
    AddRounded,
    AutoAwesomeRounded,
    DeleteOutlineRounded,
    DownloadRounded,
    EditOutlined,
    ToggleOffRounded,
    ToggleOnRounded,
} from "@mui/icons-material";

import {
    ConfirmModal,
    CountBadge,
    DataTable,
    EmptyState,
    FilterPills,
    FormDrawer,
    MobileCard,
    MobileCardList,
    MoreSheet,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    StatCard,
    StatGrid,
    StatusBadge,
    TableSkeleton,
} from "..";

const ROWS = [
    { id: 1, name: "Engineering", description: "Product engineering", employees: 12, status: "Active" },
    { id: 2, name: "Design", description: "Product design", employees: 5, status: "Active" },
    { id: 3, name: "Operations", description: "Office operations", employees: 0, status: "Inactive" },
];

const columns = [
    {
        key: "name",
        header: "Name",
        render: (row) => (
            <>
                <span className="admin-cell-primary">{row.name}</span>
                <span className="admin-cell-sub">{row.description}</span>
            </>
        ),
    },
    {
        key: "employees",
        header: "Employees",
        render: (row) => (
            <CountBadge value={row.employees} label="employees" />
        ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
        key: "actions",
        header: "Actions",
        align: "right",
        render: (row) => (
            <RowActions
                actions={[
                    {
                        key: "toggle",
                        label: row.status === "Active" ? "Deactivate" : "Activate",
                        icon: row.status === "Active" ? ToggleOnRounded : ToggleOffRounded,
                        onClick: () => {},
                    },
                    { key: "edit", label: `Edit ${row.name}`, icon: EditOutlined, onClick: () => {} },
                    {
                        key: "delete",
                        label: `Delete ${row.name}`,
                        icon: DeleteOutlineRounded,
                        tone: "danger",
                        onClick: () => {},
                    },
                ]}
            />
        ),
    },
];

function AdminUiDemo() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);

    return (
        <div className="admin-demo" style={{ padding: 24, background: "#F3F4F8", minHeight: "100vh" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1180, margin: "0 auto" }}>
                <PageHeader
                    title="Departments"
                    subtitle="Manage organizational departments"
                    actions={[
                        { key: "export", label: "Export CSV", icon: DownloadRounded, onClick: () => {} },
                        { key: "ai", label: "AI Insights", icon: AutoAwesomeRounded, onClick: () => {} },
                        {
                            key: "add",
                            label: "Add Department",
                            icon: AddRounded,
                            variant: "primary",
                            onClick: () => setDrawerOpen(true),
                        },
                    ]}
                />

                <StatGrid>
                    <StatCard label="Total Departments" value={3} sublabel="All departments" />
                    <StatCard label="Active" value={2} sublabel="Currently running" />
                    <StatCard label="Inactive" value={1} sublabel="Paused departments" />
                    <StatCard label="Total Employees" value={17} sublabel="Across departments" />
                </StatGrid>

                <div className="admin-toolbar">
                    <div className="admin-toolbar-left">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Search departments..."
                            ariaLabel="Search departments"
                        />
                    </div>
                    <div className="admin-toolbar-right">
                        <FilterPills
                            ariaLabel="Filter departments by status"
                            value={status}
                            onChange={setStatus}
                            options={[
                                { key: "all", label: "All", count: 3 },
                                { key: "active", label: "Active", count: 2 },
                                { key: "inactive", label: "Inactive", count: 1 },
                            ]}
                        />
                    </div>
                </div>

                <DataTable
                    ariaLabel="Departments"
                    columns={columns}
                    rows={ROWS}
                    rowKey="id"
                    skeletonRows={3}
                    empty={<EmptyState title="Koi department nahi mili." subtitle="Add your first department." />}
                />

                <Pagination page={0} pageSize={2} total={3} onPageChange={() => {}} />

                <MobileCardList
                    items={ROWS}
                    getKey={(row) => row.id}
                    renderItem={(row) => (
                        <MobileCard
                            title={row.name}
                            subtitle={row.description}
                            badge={<StatusBadge status={row.status} />}
                            fields={[
                                { label: "Employees", value: row.employees },
                                { label: "Status", value: row.status },
                            ]}
                            actions={[
                                { key: "edit", label: "Edit", icon: EditOutlined, onClick: () => {} },
                                {
                                    key: "delete",
                                    label: "Delete",
                                    icon: DeleteOutlineRounded,
                                    tone: "danger",
                                    onClick: () => {},
                                },
                            ]}
                        />
                    )}
                />

                <div style={{ background: "#fff", borderRadius: 18, padding: 16 }}>
                    <h3 style={{ marginTop: 0 }}>States</h3>
                    <TableSkeleton rows={3} columns={4} />
                </div>

                <div style={{ background: "#fff", borderRadius: 18 }}>
                    <EmptyState
                        title="Kuch nahi mila."
                        subtitle="Try a different search or filter."
                    />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="admin-btn is-primary-solid" onClick={() => setConfirmOpen(true)}>
                        Open confirm modal
                    </button>
                    <button type="button" className="admin-btn is-ghost-dark" onClick={() => setMoreOpen(true)}>
                        Open more sheet
                    </button>
                </div>
            </div>

            <FormDrawer
                open={drawerOpen}
                title="Add Department"
                submitLabel="Create"
                onClose={() => setDrawerOpen(false)}
                onSubmit={() => setDrawerOpen(false)}
            >
                <TextField label="Department name" fullWidth size="small" />
                <TextField label="Description" fullWidth size="small" multiline rows={3} />
            </FormDrawer>

            <ConfirmModal
                open={confirmOpen}
                title="Delete Engineering"
                message="Ye wapas nahi hoga."
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => setConfirmOpen(false)}
            />

            <MoreSheet
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                onLogout={() => {}}
                items={[
                    { key: "departments", label: "Departments", icon: AutoAwesomeRounded, onClick: () => {} },
                    { key: "users", label: "Admin & HR Users", icon: EditOutlined, onClick: () => {} },
                ]}
            />
        </div>
    );
}

export default AdminUiDemo;
