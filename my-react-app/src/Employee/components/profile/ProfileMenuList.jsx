import React from "react";
import {
    ChevronRight,
    FolderCopyOutlined,
    LogoutOutlined,
    PeopleOutlined,
    PersonOutlined,
} from "@mui/icons-material";

function ProfileMenuList({
    role,
    teamCount,
    onPersonal,
    onDocuments,
    onLogout,
}) {
    const showTeam = role === "MANAGER" && Number(teamCount) > 0;

    return (
        <section className="emp-profile-menu" aria-label="Profile options">
            <button type="button" className="emp-profile-menu-row" onClick={onPersonal}>
                <span className="emp-profile-menu-icon is-purple">
                    <PersonOutlined />
                </span>
                <span className="emp-profile-menu-text">
                    <strong>Personal info</strong>
                    <small>Contact and work details</small>
                </span>
                <ChevronRight className="emp-profile-menu-chevron" />
            </button>

            <button type="button" className="emp-profile-menu-row" onClick={onDocuments}>
                <span className="emp-profile-menu-icon is-blue">
                    <FolderCopyOutlined />
                </span>
                <span className="emp-profile-menu-text">
                    <strong>Documents</strong>
                    <small>Marksheets and government ID</small>
                </span>
                <ChevronRight className="emp-profile-menu-chevron" />
            </button>

            {showTeam && (
                <button type="button" className="emp-profile-menu-row">
                    <span className="emp-profile-menu-icon is-green">
                        <PeopleOutlined />
                    </span>
                    <span className="emp-profile-menu-text">
                        <strong>Team</strong>
                        <small>{teamCount} members reporting to you</small>
                    </span>
                    <ChevronRight className="emp-profile-menu-chevron" />
                </button>
            )}

            <button type="button" className="emp-profile-menu-row is-danger" onClick={onLogout}>
                <span className="emp-profile-menu-icon is-red">
                    <LogoutOutlined />
                </span>
                <span className="emp-profile-menu-text">
                    <strong>Logout</strong>
                    <small>Sign out of your account</small>
                </span>
                <ChevronRight className="emp-profile-menu-chevron" />
            </button>
        </section>
    );
}

export default ProfileMenuList;
