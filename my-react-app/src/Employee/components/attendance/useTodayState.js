import { useCallback, useEffect, useRef, useState } from "react";
import attendanceServ from "../../../services/attendanceService";
import { unwrapOne } from "./attendanceUtils";

const RESYNC_INTERVAL_MS = 5 * 60 * 1000;

const timeValue = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
};

function useTodayState() {
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => new Date());
    const offsetRef = useRef(0);
    const requestRef = useRef(0);

    const load = useCallback(async ({ silent = false } = {}) => {
        const requestId = requestRef.current + 1;
        requestRef.current = requestId;

        if (!silent) setLoading(true);

        try {
            const response = await attendanceServ.getTodayState();
            if (requestRef.current !== requestId) return null;

            const next = unwrapOne(response);
            if (!next || typeof next !== "object") {
                throw new Error("Today's attendance state is unavailable.");
            }

            const serverNow = timeValue(next.serverNow);
            if (serverNow !== null) {
                offsetRef.current = serverNow - Date.now();
                setNow(new Date(serverNow));
            }

            setState(next);
            setError("");
            return next;
        } catch (requestError) {
            if (requestRef.current !== requestId) return null;

            const message = requestError.response?.data?.message
                || requestError.message
                || "Today's attendance load nahi ho paayi.";
            setError(message);
            return null;
        } finally {
            if (requestRef.current === requestId) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const tick = () => setNow(new Date(Date.now() + offsetRef.current));
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleFocus = () => load({ silent: true });
        const handleVisibility = () => {
            if (document.visibilityState === "visible") load({ silent: true });
        };

        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [load]);

    useEffect(() => {
        if (!state) return undefined;

        const current = Date.now() + offsetRef.current;
        const boundaries = [
            state.windowOpensAt,
            state.checkInDeadlineAt,
            state.windowClosesAt,
        ]
            .map(timeValue)
            .filter((value) => value !== null && value > current);

        const nextBoundary = boundaries.length ? Math.min(...boundaries) : null;
        const delay = nextBoundary === null
            ? RESYNC_INTERVAL_MS
            : Math.min(Math.max(nextBoundary - current + 1000, 1000), RESYNC_INTERVAL_MS);

        const timer = setTimeout(() => load({ silent: true }), delay);
        return () => clearTimeout(timer);
    }, [state, load]);

    const nowMs = now.getTime();
    const serverNowMs = timeValue(state?.serverNow) ?? nowMs;
    const elapsedSeconds = state?.attendance?.checkInTime
        ? (state.attendance.checkOutTime
            ? Number(state.elapsedSeconds) || 0
            : (Number(state.elapsedSeconds) || 0) + Math.max(0, Math.floor((nowMs - serverNowMs) / 1000)))
        : 0;

    return {
        state,
        loading,
        error,
        now,
        elapsedSeconds,
        refresh: load,
    };
}

export default useTodayState;
