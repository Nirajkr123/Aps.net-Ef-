import { useCallback, useState } from "react";
import attendanceServ from "../../../services/attendanceService";
import { getLocation } from "../../../utils/geolocation";

function useAttendancePunch({ todayRecord, onSuccess }) {
    const [punchLoading, setPunchLoading] = useState(false);
    const [punchStage, setPunchStage] = useState("");
    const [punchError, setPunchError] = useState("");

    const punch = useCallback(async () => {
        if (todayRecord?.checkInTime && todayRecord?.checkOutTime) {
            const message = "Aaj ka attendance already complete hai.";
            setPunchError(message);
            return { ok: false, message };
        }

        setPunchLoading(true);
        setPunchStage("locating");
        setPunchError("");

        try {
            const location = await getLocation();
            setPunchStage("saving");

            const mode = todayRecord?.checkInTime ? "out" : "in";
            if (mode === "in") {
                await attendanceServ.checkIn(location);
            } else {
                await attendanceServ.checkOut(location);
            }

            await onSuccess?.(mode);
            return { ok: true, mode };
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
    }, [todayRecord, onSuccess]);

    return {
        punch,
        punchLoading,
        punchStage,
        punchError,
        clearPunchError: () => setPunchError(""),
    };
}

export default useAttendancePunch;
