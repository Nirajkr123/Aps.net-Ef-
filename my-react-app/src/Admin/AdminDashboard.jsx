import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import {
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Menu,
    MenuItem,
    Divider,
    IconButton,
    FormControl,
    InputLabel,
    Select,
} from "@mui/material";
import {
    MoreVert,
    Group,
    PersonAddAlt1,
    Timeline,
    GroupAdd,
    Refresh,
    Add,
    ArrowUpward,
    ArrowDownward,
    Close,
    VisibilityOutlined,
    DeleteOutlineOutlined,
    CheckCircleOutlined,
    PersonAdd,
} from "@mui/icons-material";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

import "./AdminDashboard.css";

// =========================
// AVATAR GRADIENT POOL (deterministic by name)
// =========================

const AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #667eea, #764ba2)",
    "linear-gradient(135deg, #f093fb, #f5576c)",
    "linear-gradient(135deg, #4facfe, #00f2fe)",
    "linear-gradient(135deg, #43e97b, #38f9d7)",
    "linear-gradient(135deg, #fa709a, #fee140)",
    "linear-gradient(135deg, #30cfd0, #330867)",
    "linear-gradient(135deg, #a8edea, #fed6e3)",
];

function avatarStyle(name) {
    const n = (name || "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return AVATAR_GRADIENTS[n % AVATAR_GRADIENTS.length];
}

function pctDelta(current, previous) {
    if (previous <= 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

function formatJoined(d) {
    if (!d || d.slice(0, 4) === "0001") return "—";
    return new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// =========================
// WEEKLY AREA CHART (pure SVG)
// =========================

function WeeklyChart({ data }) {
    const w = 560;
    const h = 190;
    const pad = 24;
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data || data.length === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }

    const max = Math.max(1, ...data.map((d) => d.count));
    const stepX = (w - pad * 2) / (data.length - 1);
    const toX = (i) => pad + i * stepX;
    const toY = (v) => h - pad - (v / max) * (h - pad * 2);

    const line = data
        .map((d, i) => `${toX(i).toFixed(1)},${toY(d.count).toFixed(1)}`)
        .join(" ");

    const area = `${pad},${h - pad} ${line} ${toX(data.length - 1).toFixed(1)},${h - pad}`;

    const maxIdx = data.reduce(
        (mi, d, i) => (d.count > data[mi].count ? i : mi),
        0
    );

    return (
        <svg
            className="week-chart-svg"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Weekly signups trend"
        >
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#667eea" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#667eea" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((f) => (
                <line
                    key={f}
                    x1={pad}
                    x2={w - pad}
                    y1={toY(max * f)}
                    y2={toY(max * f)}
                    stroke="#eef0f7"
                    strokeDasharray="4 6"
                    strokeWidth="1"
                />
            ))}

            <polygon points={area} fill="url(#areaGrad)" />
            <polyline
                points={line}
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {data.map((d, i) => (
                <circle
                    key={i}
                    cx={toX(i)}
                    cy={toY(d.count)}
                    r={hoveredIdx === i ? 7 : (i === maxIdx ? 5 : 3.5)}
                    fill={hoveredIdx === i ? "#764ba2" : (i === maxIdx ? "#764ba2" : "#667eea")}
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ cursor: "pointer", transition: "r 0.2s ease" }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                />
            ))}

            {data.map((d, i) => (
                <text
                    key={`v${i}`}
                    x={toX(i)}
                    y={toY(d.count) - 10}
                    textAnchor="middle"
                    className="week-chart-value"
                    style={{ pointerEvents: "none" }}
                >
                    {d.count}
                </text>
            ))}

            {hoveredIdx !== null && (
                <g style={{ pointerEvents: "none" }} className="chart-tooltip-group">
                    <rect
                        x={toX(hoveredIdx) - 58}
                        y={toY(data[hoveredIdx].count) - 56}
                        width="116"
                        height="44"
                        rx="10"
                        fill="#1e1b4b"
                        opacity="0.95"
                    />
                    <text
                        x={toX(hoveredIdx)}
                        y={toY(data[hoveredIdx].count) - 37}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="12"
                        fontWeight="700"
                        fontFamily="Inter, sans-serif"
                    >
                        {data[hoveredIdx].label}
                    </text>
                    <text
                        x={toX(hoveredIdx)}
                        y={toY(data[hoveredIdx].count) - 21}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.7)"
                        fontSize="10.5"
                        fontFamily="Inter, sans-serif"
                    >
                        {data[hoveredIdx].count} signups
                    </text>
                </g>
            )}

            {data.map((d, i) => (
                <text
                    key={`l${i}`}
                    x={toX(i)}
                    y={h - 6}
                    textAnchor="middle"
                    className="week-chart-label"
                    style={{ pointerEvents: "none" }}
                >
                    {d.label}
                </text>
            ))}
        </svg>
    );
}

// =========================
// ROLE DONUT (pure SVG ring)
// =========================

const ROLE_COLORS = {
    Admin: "#f59e0b",
    User: "#667eea",
};

function RoleDonut({ breakdown }) {
    const total = (breakdown || []).reduce((s, d) => s + d.count, 0);
    const size = 180;
    const stroke = 24;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const center = size / 2;
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (total === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }

    let offset = 0;

    return (
        <div className="donut-wrap">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke="#eef0f7"
                    strokeWidth={stroke}
                />
                {(breakdown || []).map((d, i) => {
                    const len = (d.count / total) * c;
                    const color = ROLE_COLORS[d.role] || "#94a3b8";
                    const dashArray = `${len - 3} ${c - len + 3}`;
                    const rotate = (offset / c) * 360 - 90;
                    offset += len;
                    return (
                        <circle
                            key={i}
                            cx={center}
                            cy={center}
                            r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth={hoveredIdx === i ? stroke + 4 : stroke}
                            strokeDasharray={dashArray}
                            transform={`rotate(${rotate} ${center} ${center})`}
                            strokeLinecap="round"
                            style={{ cursor: "pointer", transition: "stroke-width 0.2s ease" }}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        />
                    );
                })}
            </svg>
            <div className="donut-center" style={{ pointerEvents: "none" }}>
                {hoveredIdx !== null ? (
                    <>
                        <p className="donut-hover-role" style={{ color: ROLE_COLORS[breakdown[hoveredIdx].role] || "#94a3b8" }}>
                            {breakdown[hoveredIdx].role}
                        </p>
                        <p className="donut-hover-count">
                            {breakdown[hoveredIdx].count} ({Math.round((breakdown[hoveredIdx].count / total) * 100)}%)
                        </p>
                    </>
                ) : (
                    <>
                        <p className="donut-total">{total}</p>
                        <p className="donut-label">Members</p>
                    </>
                )}
            </div>
        </div>
    );
}

// =========================
// DETAIL BAR CHART (with values) for popups
// =========================

const CHART_W = 560;
const CHART_H = 220;
const CHART_PAD = 34;
const CHART_COLORS = ["#667eea", "#764ba2", "#f59e0b", "#34d399", "#f5576c", "#60a5fa"];

function ChartGrid() {
    const innerH = CHART_H - CHART_PAD * 2;
    return [0.25, 0.5, 0.75, 1].map((f) => (
        <line
            key={f}
            x1={CHART_PAD}
            x2={CHART_W - CHART_PAD}
            y1={CHART_H - CHART_PAD - innerH * f}
            y2={CHART_H - CHART_PAD - innerH * f}
            stroke="#eef0f7"
            strokeDasharray="4 6"
            strokeWidth="1"
        />
    ));
}

// BAR CHART — compares groups or counts
function BarChart({ labels, values, emphasizeLast = false }) {
    if (!values || values.length === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }
    const max = Math.max(1, ...values);
    const slot = (CHART_W - CHART_PAD * 2) / values.length;
    const barW = Math.min(52, slot * 0.55);
    return (
        <svg
            className="detail-chart-svg"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
        >
            <ChartGrid />
            {values.map((v, i) => {
                const bx = CHART_PAD + i * slot + (slot - barW) / 2;
                const bh = (v / max) * (CHART_H - CHART_PAD * 2);
                const by = CHART_H - CHART_PAD - bh;
                return (
                    <g key={i}>
                        <rect
                            x={bx}
                            y={by}
                            width={barW}
                            height={Math.max(bh, 2)}
                            rx="6"
                            fill={
                                emphasizeLast && i === values.length - 1
                                    ? "#764ba2"
                                    : "#667eea"
                            }
                        />
                        <text
                            x={CHART_PAD + i * slot + slot / 2}
                            y={by - 8}
                            textAnchor="middle"
                            className="week-chart-value"
                        >
                            {v}
                        </text>
                        <text
                            x={CHART_PAD + i * slot + slot / 2}
                            y={CHART_H - 10}
                            textAnchor="middle"
                            className="week-chart-label"
                        >
                            {(labels && labels[i]) || i + 1}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// LINE CHART — tracks trends over time
function LineChart({ labels, values }) {
    if (!values || values.length === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }
    const max = Math.max(1, ...values);
    const innerW = CHART_W - CHART_PAD * 2;
    const innerH = CHART_H - CHART_PAD * 2;
    const stepX = innerW / (values.length - 1);
    const toX = (i) => CHART_PAD + i * stepX;
    const toY = (v) => CHART_H - CHART_PAD - (v / max) * innerH;
    const line = values
        .map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
        .join(" ");
    const area = `${CHART_PAD},${CHART_H - CHART_PAD} ${line} ${toX(values.length - 1).toFixed(1)},${CHART_H - CHART_PAD}`;
    const maxIdx = values.reduce((mi, v, i) => (v > values[mi] ? i : mi), 0);
    return (
        <svg
            className="detail-chart-svg"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
        >
            <defs>
                <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#667eea" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#667eea" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <ChartGrid />
            <polygon points={area} fill="url(#lineArea)" />
            <polyline
                points={line}
                fill="none"
                stroke="#667eea"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {values.map((v, i) => (
                <g key={i}>
                    <circle
                        cx={toX(i)}
                        cy={toY(v)}
                        r={i === maxIdx ? 5 : 3.5}
                        fill={i === maxIdx ? "#764ba2" : "#667eea"}
                        stroke="#fff"
                        strokeWidth="2"
                    />
                    <text
                        x={toX(i)}
                        y={toY(v) - 10}
                        textAnchor="middle"
                        className="week-chart-value"
                    >
                        {v}
                    </text>
                    <text
                        x={toX(i)}
                        y={CHART_H - 8}
                        textAnchor="middle"
                        className="week-chart-label"
                    >
                        {(labels && labels[i]) || i + 1}
                    </text>
                </g>
            ))}
        </svg>
    );
}

// HISTOGRAM — data ranges and frequency
function HistogramChart({ labels, values }) {
    if (!values || values.length === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }
    const max = Math.max(1, ...values);
    const slot = (CHART_W - CHART_PAD * 2) / values.length;
    const barW = Math.max(8, slot * 0.8);
    return (
        <svg
            className="detail-chart-svg"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
        >
            <ChartGrid />
            {values.map((v, i) => {
                const bx = CHART_PAD + i * slot + (slot - barW) / 2;
                const bh = (v / max) * (CHART_H - CHART_PAD * 2);
                const by = CHART_H - CHART_PAD - bh;
                const color = CHART_COLORS[i % CHART_COLORS.length];
                return (
                    <g key={i}>
                        <rect
                            x={bx}
                            y={by}
                            width={barW}
                            height={Math.max(bh, 2)}
                            fill={color}
                            opacity="0.85"
                        />
                        <text
                            x={CHART_PAD + i * slot + slot / 2}
                            y={by - 8}
                            textAnchor="middle"
                            className="week-chart-value"
                        >
                            {v}
                        </text>
                        <text
                            x={CHART_PAD + i * slot + slot / 2}
                            y={CHART_H - 8}
                            textAnchor="middle"
                            className="week-chart-label"
                        >
                            {(labels && labels[i]) || i + 1}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// SCATTER PLOT — individual data points
function ScatterChart({ labels, values }) {
    if (!values || values.length === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }
    const max = Math.max(1, ...values);
    const innerW = CHART_W - CHART_PAD * 2;
    const innerH = CHART_H - CHART_PAD * 2;
    const stepX = innerW / (values.length - 1);
    const toX = (i) => CHART_PAD + i * stepX;
    const toY = (v) => CHART_H - CHART_PAD - (v / max) * innerH;
    const pts = values
        .map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
        .join(" ");
    const maxIdx = values.reduce((mi, v, i) => (v > values[mi] ? i : mi), 0);
    return (
        <svg
            className="detail-chart-svg"
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
        >
            <ChartGrid />
            <polyline
                points={pts}
                fill="none"
                stroke="#764ba2"
                strokeWidth="1.5"
                strokeDasharray="3 4"
                opacity="0.4"
            />
            {values.map((v, i) => {
                const r = i === maxIdx ? 8 : 5 + (v / max) * 5;
                return (
                    <g key={i}>
                        <circle
                            cx={toX(i)}
                            cy={toY(v)}
                            r={r}
                            fill={i === maxIdx ? "#764ba2" : "#667eea"}
                            stroke="#fff"
                            strokeWidth="2"
                        />
                        <text
                            x={toX(i)}
                            y={toY(v) - r - 6}
                            textAnchor="middle"
                            className="week-chart-value"
                        >
                            {v}
                        </text>
                        <text
                            x={toX(i)}
                            y={CHART_H - 8}
                            textAnchor="middle"
                            className="week-chart-label"
                        >
                            {(labels && labels[i]) || i + 1}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// PIE CHART — shows parts of a whole
function PieChart({ labels, values }) {
    const total = (values || []).reduce((s, v) => s + v, 0);
    if (total === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 8;
    let start = -90;
    return (
        <svg
            className="pie-chart-svg"
            viewBox={`0 0 ${size} ${size}`}
        >
            {values.map((v, i) => {
                const frac = v / total;
                const angle = start + frac * 360;
                const rad = (a) => (a * Math.PI) / 180;
                const x1 = cx + r * Math.cos(rad(start));
                const y1 = cy + r * Math.sin(rad(start));
                const x2 = cx + r * Math.cos(rad(angle));
                const y2 = cy + r * Math.sin(rad(angle));
                const largeArc = frac > 0.5 ? 1 : 0;
                const color = CHART_COLORS[i % CHART_COLORS.length];
                const midAngle = (start + angle) / 2;
                const lx = cx + (r / 1.7) * Math.cos(rad(midAngle));
                const ly = cy + (r / 1.7) * Math.sin(rad(midAngle));
                start = angle;
                return (
                    <g key={i}>
                        <path
                            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={color}
                            stroke="#fff"
                            strokeWidth="2"
                        />
                        {frac >= 0.08 && (
                            <text
                                x={lx}
                                y={ly}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="pie-slice-label"
                            >
                                {Math.round(frac * 100)}%
                            </text>
                        )}
                    </g>
                );
            })}
            <text x={cx} y={cy - 8} textAnchor="middle" className="pie-center-total">
                {total}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="pie-center-label">
                Members
            </text>
        </svg>
    );
}

const METRIC_INFO = {
    "Total Users": {
        emoji: "👥",
        chart: "histogram",
        chartTitle: "Signup frequency distribution",
        chartSub: "How often new users joined over the last 7 days (Histogram)",
        detail:
            "Total Users is the total number of registered accounts on the platform right now, including both admins and regular users. This is the overall size of your user base.",
    },
    "This Week": {
        emoji: "📈",
        chart: "line",
        chartTitle: "Signups trend over the week",
        chartSub: "Daily new signups over the last 7 days (Line graph)",
        detail:
            "This Week shows how many new users joined during the last 7 days (rolling window ending today). It tells you how active your signups have been recently.",
    },
    "Signups Today": {
        emoji: "🕐",
        chart: "bar",
        chartTitle: "Signups today vs. last 7 days",
        chartSub: "Comparing daily counts; today is highlighted (Bar graph)",
        detail:
            "Signups Today counts the registrations completed today (from 12:00 AM IST to now). It reflects real-time activity happening on the platform today.",
    },
    "7-day Trend": {
        emoji: "📊",
        chart: "line",
        chartTitle: "7-day signup trend",
        chartSub: "Movement of daily signups over the last 7 days (Line graph)",
        detail:
            "7-day Trend is the total number of signups in the trailing 7-day window, compared with the previous week. Rising numbers mean growth, falling numbers mean fewer new users.",
    },
};

function MetricPopup({ stat, onClose }) {
    const info = (stat && METRIC_INFO[stat.label]) || {
        emoji: "📊",
        detail: "Summary of this metric on the dashboard.",
    };
    const up = (stat && stat.trend) >= 0;

    return (
        <Dialog open={Boolean(stat)} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle className="modal-title">
                <span className="modal-title-icon">
                    {up ? (
                        <ArrowUpward fontSize="inherit" />
                    ) : (
                        <ArrowDownward fontSize="inherit" />
                    )}
                </span>
                {stat ? stat.label : "Metric"}
                <IconButton className="modal-close" onClick={onClose} size="small">
                    <Close fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent className="modal-body popup-body">
                {stat && (
                    <>
                        <div className="popup-hero">
                            <span className="popup-emoji">{info.emoji}</span>
                            <div>
                                <p className="popup-value">{stat.value}</p>
                                <p className="popup-caption">
                                    {stat.caption} · {Math.abs(stat.trend)}%{" "}
                                    {up ? "up" : "down"}
                                </p>
                            </div>
                        </div>
                        <p className="popup-detail">{info.detail}</p>

                        <div className="popup-chart-head">
                            <span className="popup-chart-title">{info.chartTitle}</span>
                            <span className="popup-chart-sub">{info.chartSub}</span>
                        </div>
                        {info.chart === "histogram" && (
                            <HistogramChart labels={stat.labels} values={stat.spark} />
                        )}
                        {info.chart === "bar" && (
                            <BarChart
                                labels={stat.labels}
                                values={stat.spark}
                                emphasizeLast
                            />
                        )}
                        {info.chart === "line" && (
                            <LineChart labels={stat.labels} values={stat.spark} />
                        )}
                        {info.chart === "scatter" && (
                            <ScatterChart labels={stat.labels} values={stat.spark} />
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// =========================
// CHART DETAIL POPUP (Signups Trend / Members by Role)
// =========================

function ChartPopup({ active, weeklyTrend, roleBreakdown, onClose }) {
    if (!active) return null;

    if (active === "trend") {
        const total = (weeklyTrend || []).reduce((s, d) => s + d.count, 0);
        return (
            <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle className="modal-title">
                    <span className="modal-title-icon">
                        <Timeline fontSize="inherit" />
                    </span>
                    Signups Trend
                    <IconButton className="modal-close" onClick={onClose} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="modal-body popup-body">
                    <div className="popup-hero">
                        <span className="popup-emoji">📈</span>
                        <div>
                            <p className="popup-value">{total}</p>
                            <p className="popup-caption">New signups in the last 7 days</p>
                        </div>
                    </div>
                    <p className="popup-detail">
                        This line graph shows how many new users signed up on each of the
                        last 7 days. Every point is labeled with its exact count so you can
                        see the daily pattern and spot which days had the most growth over
                        time.
                    </p>
                    <div className="popup-chart-head">
                        <span className="popup-chart-title">Daily signups trend</span>
                        <span className="popup-chart-sub">Values shown above each point (Line graph)</span>
                    </div>
                    <LineChart
                        labels={(weeklyTrend || []).map((d) => d.label)}
                        values={(weeklyTrend || []).map((d) => d.count)}
                    />
                </DialogContent>
            </Dialog>
        );
    }

    if (active === "role") {
        const total = (roleBreakdown || []).reduce((s, d) => s + d.count, 0);
        return (
            <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
                <DialogTitle className="modal-title">
                    <span className="modal-title-icon">
                        <Group fontSize="inherit" />
                    </span>
                    Members by Role
                    <IconButton className="modal-close" onClick={onClose} size="small">
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="modal-body popup-body">
                    {total > 0 ? (
                        <>
                            <div className="popup-hero">
                                <span className="popup-emoji">👤</span>
                                <div>
                                    <p className="popup-value">{total}</p>
                                    <p className="popup-caption">Total members</p>
                                </div>
                            </div>
                            <p className="popup-detail">
                                This pie chart shows how your members are split between roles.
                                Each slice is a part of the whole, and every role is listed
                                below with its exact count and its share of the total.
                            </p>
                            <PieChart
                                labels={(roleBreakdown || []).map((d) => d.role)}
                                values={(roleBreakdown || []).map((d) => d.count)}
                            />
                            <div className="donut-legend">
                                {(roleBreakdown || []).map((d) => (
                                    <div className="legend-item" key={d.role}>
                                        <span
                                            className="legend-dot"
                                            style={{
                                                background:
                                                    ROLE_COLORS[d.role] || "#94a3b8",
                                            }}
                                        />
                                        <span className="legend-name">{d.role}</span>
                                        <span className="legend-count">
                                            {d.count} ({Math.round((d.count / total) * 100)}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="chart-empty">No data yet.</p>
                    )}
                </DialogContent>
            </Dialog>
        );
    }

    return null;
}

// =========================
// MAIN DASHBOARD
// =========================

const EMPTY_FORM = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "User",
    stateId: "",
    districtId: "",
    status: "Active",
};

function AdminDashboard() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [activeNav, setActiveNav] = useState("dashboard");
    const [collapsed, setCollapsed] = useState(false);
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState([]);
    const [users, setUsers] = useState([]);
    const [weeklyTrend, setWeeklyTrend] = useState([]);
    const [roleBreakdown, setRoleBreakdown] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Selected stat for detail popup
    const [activeStat, setActiveStat] = useState(null);
    // Selected chart for detail popup: "trend" | "role" | null
    const [activeChart, setActiveChart] = useState(null);

    // Add user dialog
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState(EMPTY_FORM);
    const [addError, setAddError] = useState("");
    const [addSuccess, setAddSuccess] = useState("");
    const [addLoading, setAddLoading] = useState(false);

    // Notification dropdown
    const notifRef = useRef(null);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifReadIds, setNotifReadIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem("notifReadIds")) || []; } catch { return []; }
    });

    // User action menu
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuUser, setMenuUser] = useState(null);

    // View dialog
    const [viewUser, setViewUser] = useState(null);

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteError, setDeleteError] = useState("");
    const [deleting, setDeleting] = useState(false);

    // States & Districts for Add User form
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);

    useEffect(() => {
        try {
            const stored = JSON.parse(
                localStorage.getItem("user") || "null"
            );
            setUser(stored);
        } catch {
            setUser(null);
        }
    }, []);

    const loadDashboard = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        try {
            const response = await fetch("/api/Admin/dashboard", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                await signOut(auth);
                navigate("/login", { replace: true });
                return;
            }

            if (!response.ok) {
                throw new Error("Failed to load dashboard");
            }

            const result = await response.json();

            setUsers(result.users || []);
            const trend = result.weeklyTrend || [];
            setWeeklyTrend(trend);
            setRoleBreakdown(result.roleBreakdown || []);
            setTotalUsers(result.totalUsers ?? 0);

            const weekCounts = trend.map((d) => d.count);
            const weekLabels = trend.map((d) => d.label);
            const weekTotal = weekCounts.reduce((s, v) => s + v, 0);
            const delta = pctDelta(
                result.signupsThisWeek ?? 0,
                result.signupsLastWeek ?? 0
            );
            const todayDelta = pctDelta(
                result.signupsToday ?? 0,
                weekCounts.length > 1 ? weekCounts[weekCounts.length - 2] : 0
            );

            setStats([
                {
                    label: "Total Users",
                    value: result.totalUsers ?? 0,
                    caption: "All registered accounts",
                    trend: delta,
                    icon: Group,
                    tone: "violet",
                    spark: weekCounts,
                    labels: weekLabels,
                    filter: "total",
                },
                {
                    label: "This Week",
                    value: result.signupsThisWeek ?? 0,
                    caption: "New in last 7 days",
                    trend: delta,
                    icon: GroupAdd,
                    tone: "blue",
                    spark: weekCounts,
                    labels: weekLabels,
                    filter: "week",
                },
                {
                    label: "Signups Today",
                    value: result.signupsToday ?? 0,
                    caption: "Registrations today",
                    trend: todayDelta,
                    icon: PersonAddAlt1,
                    tone: "green",
                    spark: weekCounts,
                    labels: weekLabels,
                    filter: "today",
                },
                {
                    label: "7-day Trend",
                    value: result.signupsWeekTotal ?? weekTotal,
                    caption:
                        (result.signupsLastWeek ?? 0) +
                        " last week",
                    trend: delta,
                    icon: Timeline,
                    tone: "rose",
                    spark: weekCounts,
                    labels: weekLabels,
                    filter: "trend",
                },
            ]);
            setError("");
        } catch (err) {
            console.error("Dashboard Error:", err);
            setError(
                "Could not load dashboard data. Please check the server and try again."
            );
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch("/api/Admin/states", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((d) => setStates(Array.isArray(d) ? d : []))
            .catch(() => {});
    }, []);

    const loadDistricts = useCallback(async (stateId) => {
        if (!stateId) {
            setDistricts([]);
            return;
        }
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            const res = await fetch(`/api/Admin/districts?stateId=${stateId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDistricts(Array.isArray(data) ? data : []);
            }
        } catch {
            setDistricts([]);
        }
    }, []);

    const handleLogout = async () => {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        await signOut(auth);
        setUser(null);
        navigate("/login");
    };

    const filteredUsers = useMemo(() => {
        if (!search.trim()) return users;
        const q = search.toLowerCase();
        return users.filter(
            (u) =>
                (u.firstName || "").toLowerCase().includes(q) ||
                (u.lastName || "").toLowerCase().includes(q) ||
                (u.email || "").toLowerCase().includes(q)
        );
    }, [search, users]);

    const displayName =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.email ||
        "Admin";

    // ---------- ADD USER ----------

    const openAdd = () => {
        setAddForm(EMPTY_FORM);
        setAddError("");
        setAddSuccess("");
        setAddOpen(true);
    };

    const handleAddChange = (e) => {
        const { name, value } = e.target;
        setAddForm((f) => ({ ...f, [name]: value }));
        if (name === "stateId") {
            setAddForm((f) => ({ ...f, districtId: "" }));
            if (value) loadDistricts(value);
            else setDistricts([]);
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setAddError("");
        setAddSuccess("");
        setAddLoading(true);

        try {
            const response = await fetch("/api/User/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: addForm.firstName.trim(),
                    lastName: addForm.lastName.trim(),
                    email: addForm.email.trim(),
                    password: addForm.password,
                    role: addForm.role,
                    stateId: addForm.stateId ? Number(addForm.stateId) : null,
                    districtId: addForm.districtId ? Number(addForm.districtId) : null,
                }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setAddError(result.message || "Failed to add user");
                setAddLoading(false);
                return;
            }

            setAddSuccess("User added successfully!");
            setTimeout(() => {
                setAddOpen(false);
                setAddForm(EMPTY_FORM);
                setLoading(true);
                loadDashboard();
            }, 1000);
        } catch (err) {
            console.error("Add User Error:", err);
            setAddError("Server se connection nahi ho pa raha.");
        } finally {
            setAddLoading(false);
        }
    };

    // ---------- NOTIFICATIONS ----------

    const toggleNotifications = () => {
        setNotifOpen((o) => !o);
    };

    const notifications = users.slice(0, 5).map((u) => ({
        id: u.id,
        title: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
        sub:
            formatJoined(u.createdAt) === "—"
                ? "New member joined"
                : `New member joined on ${formatJoined(u.createdAt)}`,
    }));

    const unreadNotifications = notifications.filter((n) => !notifReadIds.includes(n.id));

    const markNotifAsRead = (id) => {
        const updated = [...new Set([...notifReadIds, id])];
        setNotifReadIds(updated);
        localStorage.setItem("notifReadIds", JSON.stringify(updated));
    };

    const markAllNotifsAsRead = () => {
        const ids = notifications.map((n) => n.id);
        const updated = [...new Set([...notifReadIds, ...ids])];
        setNotifReadIds(updated);
        localStorage.setItem("notifReadIds", JSON.stringify(updated));
    };

    // ---------- USER ACTION MENU ----------

    const openMenu = (event, u) => {
        setMenuAnchor(event.currentTarget);
        setMenuUser(u);
    };

    const closeMenu = () => {
        setMenuAnchor(null);
        setMenuUser(null);
    };

    const handleView = () => {
        setViewUser(menuUser);
        closeMenu();
    };

    const handleOpenDelete = () => {
        setDeleteTarget(menuUser);
        setDeleteError("");
        closeMenu();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError("");

        const token = localStorage.getItem("token");

        try {
            const response = await fetch(
                `/api/Admin/users/${deleteTarget.id}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                await signOut(auth);
                navigate("/login", { replace: true });
                return;
            }

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                setDeleteError(result.message || "Failed to delete user");
                setDeleting(false);
                return;
            }

            setDeleteTarget(null);
            setLoading(true);
            loadDashboard();
        } catch (err) {
            console.error("Delete Error:", err);
            setDeleteError("Server se connection nahi ho pa raha.");
        } finally {
            setDeleting(false);
        }
    };

    const renderSpark = (vals, tone) => {
        const max = Math.max(1, ...vals);
        const pts = vals
            .map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - (v / max) * 100}`)
            .join(" ");
        return (
            <svg
                className={`spark spark-${tone}`}
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
            >
                <polyline
                    points={pts}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    };

    const initial = (s) => (s || "?").charAt(0).toUpperCase();

    return (
        <div className="dash-page">
            <Sidebar
                activeKey={activeNav}
                onNavigate={(key) => {
                    if (key === "users") navigate("/users");
                    else if (key === "locations") navigate("/locations");
                    else if (key === "settings") navigate("/settings");
                    else setActiveNav(key);
                }}
                onLogout={handleLogout}
                user={user}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
            />

            <div className={`dash-main ${collapsed ? "collapsed" : ""}`}>
                <Navbar
                    search={search}
                    onSearchChange={setSearch}
                    userName={displayName}
                    userRole={user?.role || "Administrator"}
                    user={user}
                    collapsed={collapsed}
                    onToggleSidebar={() => setCollapsed((c) => !c)}
                    notificationCount={unreadNotifications.length}
                    onNotificationsClick={toggleNotifications}
                    onLogout={handleLogout}
                    onNavigate={(key) => {
                        if (key === "settings") navigate("/settings");
                    }}
                />

                <div className="dash-content">
                    <div className="dash-header">
                        <div>
                            <h1 className="dash-title">Overview</h1>
                            <p className="dash-subtitle">
                                Welcome back, {displayName.split(" ")[0]} — here's what's happening.
                            </p>
                        </div>
                        <div className="dash-header-actions">
                            <button
                                type="button"
                                className="dash-btn dash-btn-ghost"
                                onClick={() => {
                                    setLoading(true);
                                    loadDashboard();
                                }}
                            >
                                <Refresh fontSize="small" />
                                Refresh
                            </button>
                            <button type="button" className="dash-btn dash-btn-primary" onClick={openAdd}>
                                <Add fontSize="small" />
                                Add User
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="dash-loading">
                            <CircularProgress size={32} />
                            <p className="dash-loading-text">
                                Loading dashboard...
                            </p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="dash-error">{error}</div>
                    )}

                    {!loading && !error && (
                        <>
                            {/* STAT CARDS */}
                            <div className="dash-stats-grid">
                                {stats.map((stat) => {
                                    const Icon = stat.icon;
                                    const up = stat.trend >= 0;
                                    return (
                                        <div
                                            className="dash-stat-card clickable"
                                            key={stat.label}
                                            onClick={() => navigate(`/users?filter=${stat.filter}`)}
                                        >
                                            <div className="dash-stat-top">
                                                <div className={`dash-stat-icon dash-icon-${stat.tone}`}>
                                                    <Icon fontSize="inherit" />
                                                </div>
                                                <span className={`dash-stat-trend ${up ? "up" : "down"}`}>
                                                    {up ? (
                                                        <ArrowUpward fontSize="inherit" />
                                                    ) : (
                                                        <ArrowDownward fontSize="inherit" />
                                                    )}
                                                    {Math.abs(stat.trend)}%
                                                </span>
                                            </div>
                                            {renderSpark(stat.spark, stat.tone)}
                                            <p className="dash-stat-value">{stat.value}</p>
                                            <p className="dash-stat-label">{stat.label}</p>
                                            <p className="dash-stat-caption">{stat.caption}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* CHARTS ROW */}
                            <div className="dash-charts-row">
                                <div
                                    className="dash-card dash-chart-card wide clickable"
                                    onClick={() => setActiveChart("trend")}
                                >
                                    <div className="dash-card-head">
                                        <div>
                                            <p className="dash-card-title">Signups Trend</p>
                                            <p className="dash-card-sub">Last 7 days</p>
                                        </div>
                                        <span className="dash-chip">Weekly</span>
                                    </div>
                                    <WeeklyChart data={weeklyTrend} />
                                </div>

                                <div
                                    className="dash-card dash-chart-card clickable"
                                    onClick={() => setActiveChart("role")}
                                >
                                    <div className="dash-card-head">
                                        <div>
                                            <p className="dash-card-title">Members by Role</p>
                                            <p className="dash-card-sub">Role distribution</p>
                                        </div>
                                    </div>
                                    <RoleDonut breakdown={roleBreakdown} />
                                    <div className="donut-legend">
                                        {(roleBreakdown || []).map((d) => (
                                            <div className="legend-item" key={d.role}>
                                                <span
                                                    className="legend-dot"
                                                    style={{
                                                        background: ROLE_COLORS[d.role] || "#94a3b8",
                                                    }}
                                                />
                                                <span className="legend-name">{d.role}</span>
                                                <span className="legend-count">{d.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RECENT USERS (last 5) */}
                            <div className="dash-card dash-panel">
                                <div className="dash-panel-header">
                                    <div>
                                        <p className="dash-card-title">Recent Users</p>
                                        <p className="dash-card-sub">Latest 5 registered accounts</p>
                                    </div>
                                    <span className="dash-panel-count">
                                        {filteredUsers.length} of {Math.min(totalUsers, users.length)}
                                    </span>
                                </div>

                                <div className="dash-table">
                                    <div className="dash-table-head">
                                        <span>User</span>
                                        <span>Role</span>
                                        <span>Joined</span>
                                        <span />
                                    </div>

                                    {filteredUsers.map((u) => {
                                        const name =
                                            [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
                                        const role = u.role || "User";
                                        return (
                                            <div
                                                className="dash-table-row"
                                                key={u.id}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => setViewUser(u)}
                                            >
                                                <div className="dash-user-cell">
                                                    <div
                                                        className="dash-user-avatar"
                                                        style={{ background: avatarStyle(name) }}
                                                    >
                                                        {initial(name)}
                                                    </div>
                                                    <div className="dash-user-info">
                                                        <p className="dash-user-name">{name}</p>
                                                        <p className="dash-user-email">{u.email}</p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className={`dash-role-chip ${role === "Admin" ? "admin" : ""}`}>
                                                        {role}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="dash-user-date">{formatJoined(u.createdAt)}</span>
                                                </div>
                                                <div>
                                                    <IconButton
                                                        className="dash-more-btn"
                                                        aria-label="More options"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openMenu(e, u);
                                                        }}
                                                    >
                                                        <MoreVert fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredUsers.length === 0 && (
                                        <div className="dash-empty-state">
                                            <p className="dash-empty-text">
                                                {search
                                                    ? `No users match "${search}"`
                                                    : "No users yet."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ======= USER ACTION MENU ======= */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={closeMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ className: "pop-menu" }}
            >
                <MenuItem onClick={handleView} className="pop-menu-item">
                    <VisibilityOutlined fontSize="small" className="pop-menu-icon" />
                    View Details
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleOpenDelete} className="pop-menu-item danger">
                    <DeleteOutlineOutlined fontSize="small" className="pop-menu-icon" />
                    Delete User
                </MenuItem>
            </Menu>

            {/* ======= NOTIFICATIONS DROPDOWN ======= */}
            <div className="notif-wrap">
                {notifOpen && (
                    <div className="notif-pop" ref={notifRef}>
                        <div className="notif-pop-head">
                            <span className="notif-pop-title">Notifications</span>
                            <span className="notif-pop-count">{unreadNotifications.length}</span>
                        </div>
                        <div className="notif-pop-list">
                            {notifications.length === 0 && (
                                <p className="notif-empty">No notifications yet.</p>
                            )}
                            {notifications.map((n) => (
                                <div
                                    className={`notif-item ${notifReadIds.includes(n.id) ? "notif-item-read" : ""}`}
                                    key={n.id}
                                    onClick={() => markNotifAsRead(n.id)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <span className="notif-item-dot" />
                                    <div className="notif-item-body">
                                        <p className="notif-item-title">{n.title}</p>
                                        <p className="notif-item-sub">{n.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            className="notif-pop-footer"
                            onClick={() => { markAllNotifsAsRead(); setNotifOpen(false); }}
                        >
                            Mark all as read
                        </button>
                    </div>
                )}
            </div>

            {/* ======= ADD USER DIALOG ======= */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle className="modal-title">
                    <span className="modal-title-icon">
                        <PersonAdd fontSize="inherit" />
                    </span>
                    Add New User
                    <IconButton
                        className="modal-close"
                        onClick={() => setAddOpen(false)}
                        size="small"
                    >
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <form onSubmit={handleAddSubmit}>
                    <DialogContent className="modal-body">
                        {addSuccess && (
                            <div className="modal-success">
                                <CheckCircleOutlined fontSize="small" />
                                {addSuccess}
                            </div>
                        )}
                        {addError && <div className="modal-error">{addError}</div>}
                        <div className="modal-grid">
                            <TextField
                                label="First Name"
                                name="firstName"
                                value={addForm.firstName}
                                onChange={handleAddChange}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Last Name"
                                name="lastName"
                                value={addForm.lastName}
                                onChange={handleAddChange}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Email"
                                name="email"
                                type="email"
                                value={addForm.email}
                                onChange={handleAddChange}
                                fullWidth
                                required
                                sx={{ gridColumn: "1 / -1" }}
                            />
                            <TextField
                                label="Password"
                                name="password"
                                type="password"
                                value={addForm.password}
                                onChange={handleAddChange}
                                fullWidth
                                required
                                sx={{ gridColumn: "1 / -1" }}
                            />
                            <FormControl fullWidth>
                                <InputLabel>Role</InputLabel>
                                <Select label="Role" name="role" value={addForm.role} onChange={handleAddChange}>
                                    <MenuItem value="User">User</MenuItem>
                                    <MenuItem value="Staff">Staff</MenuItem>
                                    <MenuItem value="Admin">Admin</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select label="Status" name="status" value={addForm.status} onChange={handleAddChange}>
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Inactive">Inactive</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>State</InputLabel>
                                <Select label="State" name="stateId" value={addForm.stateId} onChange={handleAddChange}>
                                    <MenuItem value="">Select State</MenuItem>
                                    {states.map((s) => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>District</InputLabel>
                                <Select label="District" name="districtId" value={addForm.districtId}
                                    disabled={!addForm.stateId} onChange={handleAddChange}>
                                    <MenuItem value="">Select District</MenuItem>
                                    {districts.map((d) => (
                                        <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>
                    </DialogContent>
                    <DialogActions className="modal-actions">
                        <Button onClick={() => setAddOpen(false)} className="modal-btn-cancel">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addLoading}
                            className="modal-btn-submit"
                        >
                            {addLoading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Add User"}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* ======= VIEW USER DIALOG ======= */}
            <Dialog
                open={Boolean(viewUser)}
                onClose={() => setViewUser(null)}
                maxWidth="xs"
                fullWidth
            >
                {viewUser && (
                    <>
                        <DialogTitle className="modal-title">
                            User Details
                            <IconButton
                                className="modal-close"
                                onClick={() => setViewUser(null)}
                                size="small"
                            >
                                <Close fontSize="small" />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent className="modal-body view-body">
                            <div
                                className="view-avatar"
                                style={{
                                    background: avatarStyle(
                                        [viewUser.firstName, viewUser.lastName].filter(Boolean).join(" ")
                                    ),
                                }}
                            >
                                {initial([viewUser.firstName, viewUser.lastName].filter(Boolean).join(" ") || viewUser.email)}
                            </div>
                            <p className="view-name">
                                {[viewUser.firstName, viewUser.lastName].filter(Boolean).join(" ") || viewUser.email}
                            </p>
                            <p className="view-email">{viewUser.email}</p>
                            <div className="view-meta">
                                <div className="view-meta-item">
                                    <span className="view-meta-label">Role</span>
                                    <span className="dash-role-chip">{viewUser.role || "User"}</span>
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">Joined</span>
                                    <span className="view-meta-value">{formatJoined(viewUser.createdAt)}</span>
                                </div>
                                <div className="view-meta-item">
                                    <span className="view-meta-label">User ID</span>
                                    <span className="view-meta-value">#{viewUser.id}</span>
                                </div>
                            </div>
                        </DialogContent>
                    </>
                )}
            </Dialog>

            {/* ======= DELETE CONFIRM DIALOG ======= */}
            <Dialog
                open={Boolean(deleteTarget)}
                onClose={() => setDeleteTarget(null)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle className="modal-title confirm-title">
                    Delete User
                    <IconButton
                        className="modal-close"
                        onClick={() => setDeleteTarget(null)}
                        size="small"
                    >
                        <Close fontSize="small" />
                    </IconButton>
                </DialogTitle>
                <DialogContent className="modal-body">
                    {deleteError && <div className="modal-error">{deleteError}</div>}
                    <p className="confirm-text">
                        Are you sure you want to delete{" "}
                        <strong>
                            {deleteTarget
                                ? [deleteTarget.firstName, deleteTarget.lastName].filter(Boolean).join(" ") ||
                                  deleteTarget.email
                                : ""}
                        </strong>
                        ? This action cannot be undone.
                    </p>
                </DialogContent>
                <DialogActions className="modal-actions">
                    <Button onClick={() => setDeleteTarget(null)} className="modal-btn-cancel">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="modal-btn-danger"
                    >
                        {deleting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ======= METRIC DETAIL POPUP ======= */}
            <MetricPopup stat={activeStat} onClose={() => setActiveStat(null)} />

            {/* ======= CHART DETAIL POPUP ======= */}
            <ChartPopup
                active={activeChart}
                weeklyTrend={weeklyTrend}
                roleBreakdown={roleBreakdown}
                onClose={() => setActiveChart(null)}
            />
        </div>
    );
}

export default AdminDashboard;
