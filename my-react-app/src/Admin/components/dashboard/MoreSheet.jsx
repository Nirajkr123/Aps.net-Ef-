import React from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, IconButton } from "@mui/material";
import {
    AccountTreeOutlined,
    AssignmentTurnedInOutlined,
    BadgeOutlined,
    Close,
    LocationCityOutlined,
    LogoutOutlined,
    MapOutlined,
    PeopleAltOutlined,
    ScheduleOutlined,
} from "@mui/icons-material";

const COMMON_ITEMS = [
    { key: "departments", label: "Departments", icon: AccountTreeOutlined, path: "/departments" },
    { key: "designations", label: "Designations", icon: BadgeOutlined, path: "/designations" },
    { key: "shifts", label: "Shifts", icon: ScheduleOutlined, path: "/shifts" },
    {
        key: "shift-assignments",
        label: "Shift Assignments",
        icon: AssignmentTurnedInOutlined,
        path: "/shift-assignments",
    },
    { key: "users", label: "Admin & HR Users", icon: PeopleAltOutlined, path: "/users" },
];

const LOCATION_ITEMS = {
    OWNER: {
        key: "locations",
        label: "Locations",
        icon: LocationCityOutlined,
        path: "/locations",
    },
    HR: {
        key: "work-locations",
        label: "Work Locations",
        icon: MapOutlined,
        path: "/work-locations",
    },
};

function MoreSheet({ open, role = "OWNER", onClose, onLogout }) {
    const navigate = useNavigate();
    const locationItem = LOCATION_ITEMS[role] || LOCATION_ITEMS.OWNER;
    const items = [...COMMON_ITEMS, locationItem];

    const go = (path) => {
        onClose();
        navigate(path);
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{ className: "owner-more-sheet" }}
        >
            <div className="owner-more-head">
                <h2>More</h2>
                <IconButton onClick={onClose} aria-label="Close more menu">
                    <Close fontSize="small" />
                </IconButton>
            </div>

            <div className="owner-more-list">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            className="owner-more-item"
                            onClick={() => go(item.path)}
                        >
                            <span className="owner-more-icon">
                                <Icon fontSize="small" />
                            </span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}

                <button type="button" className="owner-more-item is-logout" onClick={onLogout}>
                    <span className="owner-more-icon">
                        <LogoutOutlined fontSize="small" />
                    </span>
                    <span>Logout</span>
                </button>
            </div>
        </Drawer>
    );
}

export default MoreSheet;
