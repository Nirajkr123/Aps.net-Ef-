import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Badge, IconButton, Popover, Typography, Box, Divider, Button, CircularProgress, useMediaQuery,
} from "@mui/material";
import {
    NotificationsNoneOutlined,
    AccessTimeOutlined,
    PersonOutlineOutlined,
    CampaignOutlined,
    EventAvailableOutlined,
    PaymentsOutlined,
    DescriptionOutlined,
} from "@mui/icons-material";

import notificationServ from "../../services/notificationService";
import { requestPermissionAndGetToken, listenForMessages } from "../../services/pushService";

const POLL_INTERVAL_MS = 30000;
const PAGE_SIZE = 15;

const TYPE_ICONS = {
    CheckIn: <AccessTimeOutlined fontSize="small" />,
    CheckOut: <AccessTimeOutlined fontSize="small" />,
    Leave: <EventAvailableOutlined fontSize="small" />,
    Announcement: <CampaignOutlined fontSize="small" />,
    Payslip: <PaymentsOutlined fontSize="small" />,
    Document: <DescriptionOutlined fontSize="small" />,
    General: <PersonOutlineOutlined fontSize="small" />,
};

const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function NotificationBell() {
    const [apiNotifications, setApiNotifications] = useState([]);
    const [apiUnreadCount, setApiUnreadCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const pushInitialized = useRef(false);

    /* Leave-workflow notifications bhi `GET /api/Notifications` se hi aati
       hain — backend `LeaveService` apply/approve/reject par banata hai.
       Isiliye dropdown sirf ek source pe hai; pehle yahan LeaveContext ka
       doosra list merge hota tha, jo har page load par wahi rows dobara
       laati aur duplicate dikhaati. */
    const notifications = useMemo(
        () => [...apiNotifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        [apiNotifications]
    );

    const unreadCount = apiUnreadCount;

    const isMobile = useMediaQuery(theme => theme.breakpoints.down("sm"));

    useEffect(() => {
        if (!open || !isMobile) return undefined;

        const scrollY = window.scrollY;
        const { body } = document;
        const prevOverflow = body.style.overflow;
        const prevPosition = body.style.position;
        const prevTop = body.style.top;
        const prevWidth = body.style.width;

        body.style.overflow = "hidden";
        body.style.position = "fixed";
        body.style.top = `-${scrollY}px`;
        body.style.width = "100%";

        return () => {
            body.style.overflow = prevOverflow;
            body.style.position = prevPosition;
            body.style.top = prevTop;
            body.style.width = prevWidth;
            window.scrollTo(0, scrollY);
        };
    }, [open, isMobile]);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const { data } = await notificationServ.getUnreadCount();
            setApiUnreadCount(data?.count ?? 0);
        } catch {
            /* API down ho to badge jhuka na dikhe — leave wale unread
               badge me continue dikhte rahenge. */
            setApiUnreadCount(0);
        }
    }, []);

    const fetchFirstPage = useCallback(async () => {
        try {
            const { data } = await notificationServ.getAll(PAGE_SIZE, 0);
            const list = Array.isArray(data) ? data : [];
            setApiNotifications(list);
            setHasMore(list.length === PAGE_SIZE);
        } catch {
            setApiNotifications([]);
            setHasMore(false);
        }
    }, []);

    /* Sirf API wali list paginate hoti hai (leave ki poori list context me
       already rehti hai). Offset = sirf fetched api rows, warna leave ki
       entries count karke pages chhoot jaate. */
    const loadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const { data } = await notificationServ.getAll(PAGE_SIZE, apiNotifications.length);
            const list = Array.isArray(data) ? data : [];
            setHasMore(list.length === PAGE_SIZE);
            setApiNotifications((prev) => {
                const seen = new Set(prev.map((n) => n.id));
                return [...prev, ...list.filter((n) => !seen.has(n.id))];
            });
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [apiNotifications.length]);

    const refresh = useCallback(() => {
        fetchFirstPage();
        fetchUnreadCount();
    }, [fetchFirstPage, fetchUnreadCount]);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    useEffect(() => {
        if (pushInitialized.current) return;
        pushInitialized.current = true;

        let unsubscribe = () => {};

        requestPermissionAndGetToken()
            .then((token) => {
                if (token) notificationServ.registerDeviceToken(token).catch(() => {});
            })
            .catch(() => {});

        unsubscribe = listenForMessages(() => refresh());

        return () => unsubscribe();
    }, [refresh]);

    /* Optimistic update: UI turant mark ho jaata hai, API call background
       me chalti hai. Fail ho to bhi stale read-mark reh jaata hai (koi data
       loss nahi) — agli refresh me sahi count aata hai. */
    const markAllRead = async () => {
        setApiNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setApiUnreadCount(0);
        try {
            await notificationServ.markAllRead();
        } catch {
            // ignore - UI already updated
        }
    };

    const markOneRead = async (n) => {
        if (n.isRead) return;
        setApiNotifications((prev) =>
            prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        setApiUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
        try {
            await notificationServ.markRead([n.id]);
        } catch {
            // ignore - UI already updated
        }
    };

    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <IconButton
                className="navbar-icon-btn"
                aria-label="Notifications"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                size="small"
                sx={{ position: "relative" }}
            >
                <NotificationsNoneOutlined fontSize="small" />
                {unreadCount > 0 && (
                    <Badge
                        badgeContent={unreadCount > 99 ? "99+" : unreadCount}
                        color="error"
                        sx={{
                            "& .MuiBadge-badge": {
                                fontSize: 10,
                                height: 18,
                                minWidth: 18,
                                borderRadius: 9,
                            },
                        }}
                    />
                )}
            </IconButton>

            <Popover
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        sx: {
                            width: { xs: "calc(100vw - 24px)", sm: 360 },
                            maxWidth: 360,
                            mt: 1,
                            borderRadius: 3,
                            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
                            border: "1px solid #eceef5",
                            maxHeight: { xs: "calc(100dvh - 96px)", sm: 520 },
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        },
                    },
                }}
            >
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexShrink: 0,
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#171b2e" }}>
                        Notifications
                        {unreadCount > 0 && (
                            <Typography component="span" variant="caption" sx={{ ml: 0.75, color: "#9ca3af", fontWeight: 500 }}>
                                {unreadCount} unread
                            </Typography>
                        )}
                    </Typography>
                </Box>
                <Divider />

                <Box sx={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
                    {notifications.length === 0 ? (
                        <Box sx={{ py: 4, textAlign: "center" }}>
                            <NotificationsNoneOutlined sx={{ color: "#d1d5db", fontSize: 32, mb: 1 }} />
                            <Typography variant="body2" sx={{ color: "#9ca3af" }}>
                                No notifications yet.
                            </Typography>
                        </Box>
                    ) : (
                        notifications.map((n) => (
                            <Box
                                key={n.id}
                                onClick={() => !n.isRead && markOneRead(n)}
                                sx={{
                                    display: "flex",
                                    gap: 1.25,
                                    px: 2,
                                    py: 1.25,
                                    alignItems: "flex-start",
                                    cursor: n.isRead ? "default" : "pointer",
                                    bgcolor: n.isRead ? "transparent" : "#f8f7ff",
                                    borderLeft: "3px solid",
                                    borderLeftColor: n.isRead ? "transparent" : "#4f46e5",
                                    opacity: n.isRead ? 0.62 : 1,
                                    transition: "background-color 120ms ease",
                                    "&:hover": { bgcolor: n.isRead ? "#f6f7fb" : "#f0eeff" },
                                }}
                            >
                                <Box sx={{ color: n.isRead ? "#c4c9d4" : "#4f46e5", mt: 0.25, flexShrink: 0 }}>
                                    {TYPE_ICONS[n.type] || TYPE_ICONS.General}
                                </Box>

                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontWeight: n.isRead ? 500 : 700, color: "#171b2e" }}
                                    >
                                        {n.title}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: "#6b7280", display: "block", mt: 0.25, wordBreak: "break-word" }}
                                    >
                                        {n.message}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: "#9ca3af", mt: 0.5, display: "block", fontSize: 10.5 }}
                                    >
                                        {formatTime(n.createdAt)}
                                        {!n.isRead && " • Unread"}
                                    </Typography>
                                </Box>
                            </Box>
                        ))
                    )}
                </Box>

                {(hasMore || unreadCount > 0) && (
                    <>
                        <Divider />
                        <Box
                            sx={{
                                p: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                                flexShrink: 0,
                                bgcolor: "#fff",
                            }}
                        >
                            {hasMore && (
                                <Button
                                    size="small"
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    sx={{ color: "#4f46e5", fontWeight: 600, textTransform: "none" }}
                                >
                                    {loadingMore ? <CircularProgress size={16} /> : "Load older notifications"}
                                </Button>
                            )}
                            {unreadCount > 0 && (
                                <Button
                                    size="small"
                                    onClick={markAllRead}
                                    sx={{
                                        color: "#4f46e5",
                                        fontWeight: 600,
                                        textTransform: "none",
                                        bgcolor: "#f3f2ff",
                                        "&:hover": { bgcolor: "#e9e7ff" },
                                    }}
                                >
                                    Mark all as read
                                </Button>
                            )}
                        </Box>
                    </>
                )}
            </Popover>
        </Box>
    );
}

export default NotificationBell;
