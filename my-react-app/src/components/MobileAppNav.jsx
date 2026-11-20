import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import { auth } from "../firebase";
import BottomNav from "../Employee/components/dashboard/BottomNav";
import MobileBottomNav from "../Admin/components/dashboard/MobileBottomNav";
import MoreSheet from "../Admin/components/dashboard/MoreSheet";
import useIsMobile from "../hooks/useIsMobile";

import "../Employee/EmployeeDashboard.css";
import "../Admin/components/dashboard/OwnerDashboard.css";
import "./MobileAppNav.css";

const AUTH_ROUTES = ["/", "/signup", "/login", "/forgot-password"];

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
}

function MobileAppNav() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [user, setUser] = useState(getStoredUser);
    const [moreOpen, setMoreOpen] = useState(false);

    useEffect(() => {
        setUser(getStoredUser());
        setMoreOpen(false);
    }, [pathname]);

    const isAuthRoute = AUTH_ROUTES.includes(pathname);
    const visible = isMobile && !!user && !isAuthRoute;

    useEffect(() => {
        document.body.classList.toggle("has-mobile-nav", visible);
        return () => document.body.classList.remove("has-mobile-nav");
    }, [visible]);

    if (!visible) return null;

    if (user.role === "EMPLOYEE") {
        return <BottomNav />;
    }

    if (user.role !== "OWNER" && user.role !== "HR") {
        return null;
    }

    const handleLogout = async () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setMoreOpen(false);
        await signOut(auth);
        navigate("/login");
    };

    return (
        <>
            <MobileBottomNav onMore={() => setMoreOpen(true)} />
            <MoreSheet
                open={moreOpen}
                role={user.role}
                onClose={() => setMoreOpen(false)}
                onLogout={handleLogout}
            />
        </>
    );
}

export default MobileAppNav;
