import { useEffect, useState } from "react";

export const MOBILE_BREAKPOINT = 768;

function getMatches(breakpoint) {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
}

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
    const [isMobile, setIsMobile] = useState(() => getMatches(breakpoint));

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return undefined;
        }

        const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const handleChange = (event) => setIsMobile(event.matches);

        setIsMobile(query.matches);

        if (typeof query.addEventListener === "function") {
            query.addEventListener("change", handleChange);
            return () => query.removeEventListener("change", handleChange);
        }

        query.addListener(handleChange);
        return () => query.removeListener(handleChange);
    }, [breakpoint]);

    return isMobile;
}

export default useIsMobile;
