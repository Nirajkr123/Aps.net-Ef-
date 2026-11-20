import { useCallback, useState } from "react";
import attendanceServ from "../../../services/attendanceService";
import { getLocation } from "../../../utils/geolocation";
import { resolveTodayWindow } from "./attendanceUtils";

function useAttendancePunch({ todayRecord, todayState, now, onSuccess }) {
    const [punchLoading, setPunchLoading] = useState(false);
    const [punchStage, setPunchStage] = useState("");
    const [punchError, setPunchError] = useState("");
    const [punchWarning, setPunchWarning] = useState("");

    const punch = useCallback(async () => {
        const record = todayState?.attendance || todayRecord;
        const hasCheckIn = Boolean(record?.checkInTime);
        const hasCheckOut = Boolean(record?.checkOutTime);
        const windowInfo = resolveTodayWindow(todayState, now || new Date());

        if (hasCheckIn && hasCheckOut) {
            const message = "Aaj ka attendance already complete hai.";
            setPunchError(message);
            return { ok: false, message };
        }

        if (todayState) {
            const blocked = hasCheckIn
                ? !windowInfo.checkOutEnabled
                : !windowInfo.checkInEnabled;

            if (blocked) {
                const message = hasCheckIn
                    ? windowInfo.windowNote || "Check-out is not available right now."
                    : windowInfo.windowNote || "Check-in is not available right now.";
                setPunchError(message);
                return { ok: false, message };
            }
        }

        setPunchLoading(true);
        setPunchStage("locating");
        setPunchError("");
        setPunchWarning("");

        try {
            const location = await getLocation();
            setPunchStage("saving");

            const mode = hasCheckIn ? "out" : "in";
            const response = mode === "in"
                ? await attendanceServ.checkIn(location)
                : await attendanceServ.checkOut(location);

            const warning = response?.data?.warning
                || response?.data?.Warning
                || "";

            setPunchWarning(warning);
            await onSuccess?.(mode, response?.data);
            return { ok: true, mode, warning };
        } catch (error) {
            const message = error.response?.data?.message
                || error.message
                || "Attendance record nahi ho paaya. Please retry.";
            setPunchError(message);
            return { ok: false, message };
        } finally {
            setPunchLoading(false);
            setPunchStage("");
        }
    }, [todayRecord, todayState, now, onSuccess]);

    return {
        punch,
        punchLoading,
        punchStage,
        punchError,
        punchWarning,
        clearPunchError: () => setPunchError(""),
        clearPunchWarning: () => setPunchWarning(""),
    };
}

export default useAttendancePunch;
