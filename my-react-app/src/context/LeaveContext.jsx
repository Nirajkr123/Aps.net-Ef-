/* =========================================================================
   LEAVE CONTEXT  —  shared state layer for the whole leave workflow
   -------------------------------------------------------------------------
   Employee page, Admin page, Attendance page aur Notification bell — chaaron
   ko ek hi data chahiye (ek jagah approve hone par doosri jagah turant
   update). Ye unka single source of truth hai.

   Pattern: `useReducer` + `useMemo` actions. Saara I/O `leaveService` ke
   through hota hai — UI kabhi seedha store nahi chheda, sirf dispatch karta
   hai.

   Notifications is file me nahi hain: woh backend banata hai aur
   `NotificationBell` `GET /api/Notifications` se khud laata hai. Pehle yahan
   doosri list thi jo bell ke saath merge hoti thi — wahi record dobara
   dikhta.

   Provider ko `App.js` me poore router ke bahar rakha gaya hai, taaki route
   change par data reset na ho.
   ========================================================================= */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { useLocation } from "react-router-dom";

import leaveService, {
    currentEmployee,
    eachDate,
    isAdminRole,
    remainingOf,
} from "../services/leaveService";

const LeaveContext = createContext(null);

/* Identity ka chhota fingerprint — data reload tabhi dobara hoga jab
   logged-in user ya uska role sach me badle. Sirf route badalne par nahi. */
const identityKey = () => {
    const me = currentEmployee();
    return `${me?.id}|${me?.role}|${me?.name}`;
};

/* ---- Initial reducer state --------------------------------------------- */

const initialState = {
    /* Saare employees ke leaves — admin list aur employee history dono is
       SAME array se filter hote hain, isiliye dono hamesha sync rehte hain. */
    leaves: [],
    /* Current employee ka balance: { Casual:{total,used}, ... } */
    balance: null,
    loading: true,
    submitting: false,
    error: "",
};

function reducer(state, action) {
    switch (action.type) {
        case "load/start":
            return { ...state, loading: true, error: "" };
        case "load/done":
            return {
                ...state,
                loading: false,
                leaves: action.leaves,
                balance: action.balance,
            };
        case "load/error":
            return { ...state, loading: false, error: action.message };
        case "submit/start":
            return { ...state, submitting: true, error: "" };
        case "submit/done":
            return { ...state, submitting: false };
        case "error/set":
            return { ...state, error: action.message };
        case "error/clear":
            return { ...state, error: "" };

        /* Optimistic-ish local patch: service call already server ho chuka
           hai, isliye hum bas return hue record se state update karte hain.
           Isiliye list/stat cards/chart SAME frame me update ho jaate hain —
           koi refetch ka wait nahi. */
        case "leave/upsert":
            return {
                ...state,
                leaves: state.leaves.some((l) => l.id === action.leave.id)
                    ? state.leaves.map((l) => (l.id === action.leave.id ? action.leave : l))
                    : [action.leave, ...state.leaves],
            };
        case "leave/replaceAll":
            return { ...state, leaves: action.leaves };
        case "balance/set":
            return { ...state, balance: action.balance };
        default:
            return state;
    }
}

/* ---- Provider ------------------------------------------------------------ */

export function LeaveProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    /* Identity change (login / logout / role switch) par data dobara load
       hona chahiye. `localStorage` React state nahi hai, isiliye useState
       se seedha nahi pakad sakte — uska ek key banate hain aur us state me
       rakhte hain.

       Key do jagah se refresh hoti hai:
         1. Route change par — login ke baad `navigate("/my-leaves")` hota
            hai aur logout par `navigate("/login")`, dono par ye trigger ho
            jaata hai. Yaani page reload kiye bina bhi data sahi rehta
            hai (pehle sirf mount par load hota tha, to login ke baad
            khali list dikhti thi).
         2. Cross-tab par — `storage` event doosri tab ka login/logout
            yahan reflect karata hai.

       Isi `authKey` par neeche `me` bhi memo hota hai. */
    const { pathname } = useLocation();
    const [authKey, setAuthKey] = useState(() => identityKey());

    useEffect(() => {
        setAuthKey(identityKey());
    }, [pathname]);

    useEffect(() => {
        const sync = () => setAuthKey(identityKey());
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    const load = useCallback(async () => {
        dispatch({ type: "load/start" });
        try {
            /* Do calls, Promise.all me. Notifications jaan-booj kar nahi
               liye gaye — bell unhe `GET /api/Notifications` se khud
               laata hai. Yahan bhi lete to har page load par wahi rows
               dobara fetch hote. */
            const [leaves, balance] = await Promise.all([
                leaveService.getAllLeaves(),
                leaveService.getBalance(),
            ]);
            dispatch({ type: "load/done", leaves, balance });
        } catch (e) {
            dispatch({
                type: "load/error",
                message: e?.message || "Could not load leave data. Please try again.",
            });
        }
    }, []);

    useEffect(() => {
        /* Login screen par koi user nahi — wahan network call karne ka koi
           matlab nahi, to provider chup rehta hai. */
        if (!localStorage.getItem("user")) {
            dispatch({ type: "load/done", leaves: [], balance: null });
            return;
        }
        load();
    }, [load, authKey]);

    /* ---- Actions ----------------------------------------------------------
       Har action: service call → local patch. Error par reducer ka `error`
       set hota hai (page ka Alert usse dikhata hai) aur promise REJECT karta
       hai, taaki caller dialog band na kar de. */

    const applyLeave = useCallback(async (payload) => {
        dispatch({ type: "submit/start" });
        try {
            const leave = await leaveService.applyLeave(payload);
            dispatch({ type: "leave/upsert", leave });
            return leave;
        } catch (e) {
            dispatch({ type: "submit/done" });
            dispatch({ type: "error/set", message: e.message || "Could not apply for leave" });
            throw e;
        } finally {
            dispatch({ type: "submit/done" });
        }
    }, []);

    const cancelLeave = useCallback(async (id) => {
        const leave = await leaveService.cancelLeave(id);
        dispatch({ type: "leave/upsert", leave });
        return leave;
    }, []);

    const approveLeave = useCallback(async (id) => {
        const leave = await leaveService.approveLeave(id);
        dispatch({ type: "leave/upsert", leave });
        /* Balance server-side badla — UI ka number bhi turant badalna
           chahiye, warna employee page par stale dikhega. */
        const balance = await leaveService.getBalance();
        dispatch({ type: "balance/set", balance });
        return leave;
    }, []);

    const rejectLeave = useCallback(async (id, comment) => {
        const leave = await leaveService.rejectLeave(id, comment);
        dispatch({ type: "leave/upsert", leave });
        return leave;
    }, []);

    /* Bulk approve — ek-ek karke, taaki har record par server ka
       status-guard respect ho (ek fail hone par baaki bhi ruk jaayein). */
    const approveMany = useCallback(async (ids) => {
        const done = [];
        for (const id of ids) {
            const leave = await approveLeave(id);
            done.push(leave);
        }
        return done;
    }, [approveLeave]);

    /* ---- Derived values ---------------------------------------------------
       Ye sab `useMemo` me hain, taaki har render pe naye array/Set na bane
       (bade components — table, chart — inhe apne `useMemo` deps me rakhte
       hain, warna har render dobara filter karte). */

    /* `currentEmployee()` localStorage padhta hai (React state nahi), to
       har render par naya object banta hai. Ise `useMemo` se wrap karte
       hain, warna `value` ka memo bhi har render par bust hota aur
       consumers (table, chart) dobara render hote.

       ESLint ko `authKey` "unnecessary" lagta hai kyunki woh useMemo ke
       andar directly reference nahi hota — par wahi to dependency hai.
       User change hone par `authKey` badalta hai, isiliye memo bust hota
       hai aur naya identity milta hai. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const me = useMemo(() => currentEmployee(), [authKey]);

    const myLeaves = useMemo(() => {
        /* Employee role par `GET /api/leaves` server khud apni hi list
           laata hai, aur admin par poori company ki list aati hai. Isiliye
           filter tabhi lagana hai jab `me.id` pata ho.

           Pehle hamesha `l.employeeId === me.id` lagaya tha, par `me.id`
           localStorage ke `user.employeeId` se aata hai. Purani sessions
           me woh missing hota, to filter sab kuch gira deta — user ko
           khali page dikhta jabki server par data tha. `me.id` missing
           hone par list ko jaisa hai waisa rakhna behtar hai. */
        const mine = me.id
            ? state.leaves.filter((l) => l.employeeId === me.id)
            : state.leaves;
        return mine.slice().sort((a, b) => new Date(b.appliedOn) - new Date(a.appliedOn));
    }, [state.leaves, me.id]);

    /* Approved leave ke har din ki 'YYYY-MM-DD' — Attendance page inhe
       "On Leave" dikhane aur check-in block karne ke liye use karta hai. */
    const approvedLeaveDates = useMemo(() => {
        const set = new Set();
        myLeaves
            .filter((l) => l.status === "Approved")
            .forEach((l) => eachDate(l.from, l.to).forEach((d) => set.add(d)));
        return set;
    }, [myLeaves]);

    const approvedLeaves = useMemo(
        () => myLeaves.filter((l) => l.status === "Approved"),
        [myLeaves]
    );

    const isOnLeave = useCallback(
        (dateISO) => approvedLeaveDates.has(dateISO),
        [approvedLeaveDates]
    );

    /* Remaining days per type — Apply dialog ke "Casual (12 left)" labels
       aur balance card dono isi se bante hain. */
    const remaining = useMemo(
        () => (type) => remainingOf(state.balance, type),
        [state.balance]
    );

    const value = useMemo(
        () => ({
            /* raw state */
            leaves: state.leaves,
            balance: state.balance,
            loading: state.loading,
            submitting: state.submitting,
            error: state.error,

            /* identity */
            me,
            isAdmin: isAdminRole(me.role),

            /* derived */
            myLeaves,
            approvedLeaves,
            approvedLeaveDates,
            isOnLeave,
            remaining,

            /* actions */
            reload: load,
            applyLeave,
            cancelLeave,
            approveLeave,
            approveMany,
            rejectLeave,
            clearError: () => dispatch({ type: "error/clear" }),
        }),
        [
            state.leaves,
            state.balance,
            state.loading,
            state.submitting,
            state.error,
            me,
            myLeaves,
            approvedLeaves,
            approvedLeaveDates,
            isOnLeave,
            remaining,
            load,
            applyLeave,
            cancelLeave,
            approveLeave,
            approveMany,
            rejectLeave,
        ]
    );

    return <LeaveContext.Provider value={value}>{children}</LeaveContext.Provider>;
}

/* Provider ke bahar ka component (ya future me koi test) crash na ho, isliye
   safe fallback — components silently "kuch nahi" dikha dete hain. */
const SAFE_DEFAULT = {
    leaves: [],
    balance: null,
    loading: false,
    submitting: false,
    error: "",
    me: { id: null, name: "You", role: "EMPLOYEE" },
    isAdmin: false,
    myLeaves: [],
    approvedLeaves: [],
    approvedLeaveDates: new Set(),
    isOnLeave: () => false,
    remaining: () => 0,
    reload: async () => {},
    applyLeave: async () => {},
    cancelLeave: async () => {},
    approveLeave: async () => {},
    approveMany: async () => [],
    rejectLeave: async () => {},
    clearError: () => {},
};

export function useLeave() {
    return useContext(LeaveContext) || SAFE_DEFAULT;
}

export default LeaveContext;
