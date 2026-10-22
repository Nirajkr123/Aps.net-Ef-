import { useEffect, useState } from "react";
import {
  Card, CardContent, Typography, Button, Box, Chip, Divider, Skeleton,
} from "@mui/material";
import { Login, Logout, AccessTimeOutlined, ScheduleOutlined, Circle } from "@mui/icons-material";
import attendanceServ from "../services/attendanceService";
import useIsMobile from "../hooks/useIsMobile";

export default function CheckInOut() {
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState("--:--:--");
  const isMobile = useIsMobile();

  const fetchToday = async () => {
    try {
      const { data } = await attendanceServ.getToday();
      setToday(data);
    } catch {
      setToday(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchToday(); }, []);

  useEffect(() => {
    if (!today?.checkInTime || today?.checkOutTime) return;
    const tick = () => {
      const diff = Date.now() - new Date(today.checkInTime).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today]);

  const handleCheckIn = async () => {
    setError(""); setActionLoading(true);
    try { const { data } = await attendanceServ.checkIn(); setToday(data); }
    catch (e) { setError(e.response?.data?.message || "Check-in failed"); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setError(""); setActionLoading(true);
    try { const { data } = await attendanceServ.checkOut(); setToday(data); }
    catch (e) { setError(e.response?.data?.message || "Check-out failed"); }
    finally { setActionLoading(false); }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "--:-- --";

  const hasCheckedIn = !!today?.checkInTime;
  const hasCheckedOut = !!today?.checkOutTime;

  const statusConfig = (() => {
    if (!hasCheckedIn) return { label: "Not Marked", color: "#f59e0b", bg: "#fef3c7" };
    if (hasCheckedOut) return { label: "Completed", color: "#3b82f6", bg: "#dbeafe" };
    return { label: "On Duty", color: "#10b981", bg: "#d1fae5" };
  })();

  const workDayMs = 8 * 60 * 60 * 1000;
  const elapsedMs = hasCheckedIn ? Date.now() - new Date(today.checkInTime).getTime() : 0;
  const progress = Math.min(elapsedMs / workDayMs, 1);
  // Mobile pe ring chhota, warna time-boxes neeche wrap hokar card lamba kar dete hain
  const ringSize = isMobile ? 54 : 76;
  const ringRadius = isMobile ? 23 : 34;
  const ringCenter = ringSize / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - progress * circumference;

  if (loading) {
    return (
      <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", height: "100%", borderLeft: "4px solid #4f46e5" }}>
        <CardContent sx={{ p: 3.5 }}>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 2 }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{
      borderRadius: 3,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      height: "100%",
      borderLeft: "4px solid #4f46e5",
      display: "flex", flexDirection: "column",
      transition: "all 0.3s ease",
      "&:hover": { boxShadow: "0 8px 30px rgba(79,70,229,0.15)", transform: "translateY(-2px)" },
    }}>
      <CardContent sx={{ p: 2.8, flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header + Date */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 0.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#171b2e", display: "flex", alignItems: "center", gap: 1, fontSize: 16 }}>
            <AccessTimeOutlined sx={{ color: "#4f46e5" }} />
            Attendance
          </Typography>
          <Chip
            icon={<Circle sx={{ fontSize: 8, color: statusConfig.color + " !important" }} />}
            label={statusConfig.label}
            size="small"
            sx={{ bgcolor: statusConfig.bg, color: statusConfig.color, fontWeight: 600, borderRadius: 2, fontSize: 11 }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: "#9ca3af", mb: { xs: 0.75, sm: 1.5 }, fontWeight: 500, fontSize: 12.5 }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Typography>

        {/* Timer + Time Boxes */}
        <Box sx={{ display: "flex", gap: { xs: 1, sm: 2 }, mb: { xs: 0.75, sm: 1.5 }, alignItems: "center", flexWrap: "wrap" }}>
          {/* Circular Progress */}
          {hasCheckedIn && (
            <Box sx={{ position: "relative", width: ringSize, height: ringSize, flexShrink: 0 }}>
              <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="#f3f4f6" strokeWidth="5" />
                <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke={statusConfig.color} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <ScheduleOutlined sx={{ fontSize: isMobile ? 10 : 13, color: statusConfig.color, mb: 0.25 }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#171b2e", fontSize: isMobile ? 10 : 11, lineHeight: 1 }}>
                  {hasCheckedOut ? `${today.workingHours ?? 0}h` : elapsed.substring(0, 5)}
                </Typography>
                <Typography variant="caption" sx={{ color: "#9ca3af", fontSize: isMobile ? 8 : 9 }}>
                  {hasCheckedOut ? "total" : "elapsed"}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Time Boxes */}
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: { xs: 0.5, sm: 0.9 } }}>
            <Box sx={{
              display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 1.5 },
              bgcolor: hasCheckedIn ? "#f0fdf4" : "#f9fafb", borderRadius: 2, p: { xs: 0.6, sm: 1.2 },
              border: "1px solid", borderColor: hasCheckedIn ? "#bbf7d0" : "#e5e7eb",
            }}>
              <Box sx={{ width: { xs: 24, sm: 32 }, height: { xs: 24, sm: 32 }, borderRadius: "8px", bgcolor: hasCheckedIn ? "#dcfce7" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Login sx={{ fontSize: { xs: 13, sm: 16 }, color: hasCheckedIn ? "#16a34a" : "#9ca3af" }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 600, textTransform: "uppercase", fontSize: { xs: 8, sm: 9 }, display: "block" }}>Check In</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: hasCheckedIn ? "#15803d" : "#d1d5db", fontSize: { xs: 11.5, sm: 13 }, whiteSpace: "nowrap" }}>{hasCheckedIn ? fmt(today.checkInTime) : "--:-- --"}</Typography>
              </Box>
            </Box>

            <Box sx={{
              display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 1.5 },
              bgcolor: hasCheckedOut ? "#eff6ff" : "#f9fafb", borderRadius: 2, p: { xs: 0.6, sm: 1.2 },
              border: "1px solid", borderColor: hasCheckedOut ? "#bfdbfe" : "#e5e7eb",
            }}>
              <Box sx={{ width: { xs: 24, sm: 32 }, height: { xs: 24, sm: 32 }, borderRadius: "8px", bgcolor: hasCheckedOut ? "#dbeafe" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Logout sx={{ fontSize: { xs: 13, sm: 16 }, color: hasCheckedOut ? "#2563eb" : "#9ca3af" }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: "#6b7280", fontWeight: 600, textTransform: "uppercase", fontSize: { xs: 8, sm: 9 }, display: "block" }}>Check Out</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: hasCheckedOut ? "#1d4ed8" : "#d1d5db", fontSize: { xs: 11.5, sm: 13 }, whiteSpace: "nowrap" }}>{hasCheckedOut ? fmt(today.checkOutTime) : "--:-- --"}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Error */}
        {error && (
          <Typography variant="body2" sx={{ color: "#dc2626", mb: 1.5, textAlign: "center", fontWeight: 500, fontSize: 13 }}>
            {error}
          </Typography>
        )}

        {/* Action Button */}
        {!hasCheckedIn && (
          <Button variant="contained" fullWidth startIcon={<Login />} onClick={handleCheckIn} disabled={actionLoading}
            sx={{
              textTransform: "none", fontWeight: 700, borderRadius: 2, py: 1.1, fontSize: 13.5,
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              boxShadow: "0 8px 20px -6px rgba(79,70,229,0.5)",
              "&:hover": { background: "linear-gradient(135deg, #4338ca, #6d28d9)", boxShadow: "0 12px 28px -6px rgba(79,70,229,0.6)", transform: "translateY(-1px)" },
            }}>
            {actionLoading ? "Processing..." : "Check In"}
          </Button>
        )}

        {hasCheckedIn && !hasCheckedOut && (
          <Button variant="contained" fullWidth startIcon={<Logout />} onClick={handleCheckOut} disabled={actionLoading}
            sx={{
              textTransform: "none", fontWeight: 700, borderRadius: 2, py: 1.1, fontSize: 13.5,
              background: "linear-gradient(135deg, #dc2626, #f43f5e)",
              boxShadow: "0 8px 20px -6px rgba(220,38,38,0.5)",
              "&:hover": { background: "linear-gradient(135deg, #b91c1c, #e11d48)", boxShadow: "0 12px 28px -6px rgba(220,38,38,0.6)", transform: "translateY(-1px)" },
            }}>
            {actionLoading ? "Processing..." : "Check Out"}
          </Button>
        )}

        {hasCheckedOut && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 1.3, bgcolor: "#f0f9ff", borderRadius: 2, border: "1px solid #bae6fd" }}>
            <Circle sx={{ fontSize: 8, color: "#3b82f6" }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#1e40af", fontSize: 13 }}>
              Day Complete — {today.workingHours ?? 0} hrs worked
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
