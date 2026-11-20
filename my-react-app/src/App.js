import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CircularProgress, Box, ThemeProvider, createTheme, CssBaseline } from "@mui/material";

import Signup from "./SignUp/Signup";
import Login from "./Login/Login";
import ForgotPassword from "./ForgotPassword/ForgotPassword";
import AdminDashboard from "./Admin/AdminDashboard";
import UserManagement from "./Admin/UserManagement";
import ManageLocations from "./Admin/ManageLocations";
import WorkLocations from "./Admin/WorkLocations";
import Settings from "./Admin/Settings";
import EmployeeDashboard from "./Employee/EmployeeDashboard";
import EmployeeProfile from "./Employee/EmployeeProfile";
import EmployeePersonalInfo from "./Employee/EmployeePersonalInfo";
import EmployeeAttendance from "./Employee/EmployeeAttendance";
import EmployeeLeaves from "./Employee/EmployeeLeaves";
import EmployeePayslips from "./Employee/EmployeePayslips";
import AnnouncementsPage from "./Employee/AnnouncementsPage";
import AdminLeaveRequests from "./Admin/AdminLeaveRequests";
import AdminAttendance from "./Admin/AdminAttendance";
import AttendanceRegister from "./Admin/AttendanceRegister";
import Payroll from "./Admin/Payroll";
import { LeaveProvider } from "./context/LeaveContext";
import DepartmentManagement from "./modules/department/DepartmentManagement";
import DesignationManagement from "./modules/designation/DesignationManagement";
import EmployeeDirectory from "./modules/employee/EmployeeDirectory";
import ShiftManagement from "./modules/shift/ShiftManagement";
import ShiftAssign from "./modules/shift/ShiftAssign";
import MobileAppNav from "./components/MobileAppNav";

function RequireAuth({ children, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      setUser(stored);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "EMPLOYEE") {
      return <Navigate to="/my-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

const theme = createTheme();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
      {/* Leave data ka single source of truth — router ke bahar, taaki route
          change par employee/admin pages ka data reset na ho. */}
      <LeaveProvider>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* OWNER + HR routes */}
        <Route path="/dashboard" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><AdminDashboard /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><UserManagement /></RequireAuth>} />
        <Route path="/locations" element={<RequireAuth allowedRoles={["OWNER"]}><ManageLocations /></RequireAuth>} />
        <Route path="/work-locations" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><WorkLocations /></RequireAuth>} />

        {/* Phase 2 — Department, Designation, Employee (OWNER + HR) */}
        <Route path="/departments" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><DepartmentManagement /></RequireAuth>} />
        <Route path="/designations" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><DesignationManagement /></RequireAuth>} />
        <Route path="/directory" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><EmployeeDirectory /></RequireAuth>} />
        <Route path="/employees" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><EmployeeDirectory /></RequireAuth>} />
        <Route path="/admin/leaves" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><AdminLeaveRequests /></RequireAuth>} />
        <Route path="/admin/attendance" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><AdminAttendance /></RequireAuth>} />
        <Route path="/admin/attendance/register" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><AttendanceRegister /></RequireAuth>} />
        <Route path="/payroll" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><Payroll /></RequireAuth>} />
        <Route path="/shifts" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><ShiftManagement /></RequireAuth>} />
        <Route path="/shift-assignments" element={<RequireAuth allowedRoles={["OWNER", "HR"]}><ShiftAssign /></RequireAuth>} />

        {/* EMPLOYEE routes */}
        <Route path="/my-dashboard" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><EmployeeDashboard /></RequireAuth>} />
        <Route path="/my-profile" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><EmployeeProfile /></RequireAuth>} />
        <Route path="/profile/personal-info" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><EmployeePersonalInfo /></RequireAuth>} />
        <Route path="/my-attendance" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><EmployeeAttendance /></RequireAuth>} />
        <Route path="/my-leaves" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><EmployeeLeaves /></RequireAuth>} />
        <Route path="/my-payslips" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><EmployeePayslips /></RequireAuth>} />
        <Route path="/announcements" element={<RequireAuth allowedRoles={["EMPLOYEE"]}><AnnouncementsPage /></RequireAuth>} />

        {/* All roles */}
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      </Routes>
      </LeaveProvider>
      <MobileAppNav />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
