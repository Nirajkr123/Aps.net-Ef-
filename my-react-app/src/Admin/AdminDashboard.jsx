import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import adminServ from "../services/adminService";
import {
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Menu,
    MenuItem,
    Divider,
    IconButton,
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
// ROLE COLORS
// =========================

/* Role → color.

   Pehle yahan sirf `Admin`/`User` likha tha, lekin DB me role strings
   `EMPLOYEE` / `HR` / `OWNER` hain. Dono map me koi match nahi hota tha,
   isliye har slice gray (#94a3b8) me gir jata tha — isiliye admin aur
   employee ka color same dikhta tha.

   Ye `const` hai aur neeche `WeeklyChart` bhi use karta hai, isiliye
   chart component se PEHLE hi define hona zaroori hai (TDZ error). */
const ROLE_COLORS = {
    OWNER: "#667eea",
    HR: "#764ba2",
    ADMIN: "#667eea",
    EMPLOYEE: "#34d399",
    USER: "#34d399",
};

// =========================
// WEEKLY SIGNUPS CHART (pure SVG)
// =========================

/* WEEKLY SIGNUPS — stacked bars, ek stack per role.

   Pehle ye ek single purple line/area chart tha, jisme admin aur employee
   ka farak hi nahi dikhta tha. Ab har din ke bar me neeche employee aur
   upar admin stack hota hai, aur har role ka apna color hai — isiliye
   "is hafte kitne admin vs kitne employee aaye" ek nazar me pata chal
   jata hai. */
function WeeklyChart({ data }) {
    const w = 560;
    const h = 190;
    const pad = 24;
    const [hoveredIdx, setHoveredIdx] = useState(null);

    if (!data || data.length === 0) {
        return <p className="chart-empty">No data yet.</p>;
    }

    const innerH = h - pad * 2;
    const max = Math.max(1, ...data.map((d) => d.count || 0));
    const slot = (w - pad * 2) / data.length;
    const barW = Math.min(30, slot * 0.6);
    const toX = (i) => pad + i * slot + (slot - barW) / 2;
    const toY = (v) => h - pad - (v / max) * innerH;

    const maxIdx = data.reduce(
        (mi, d, i) => ((d.count || 0) > (data[mi].count || 0) ? i : mi),
        0
    );

    return (
        <svg
            className="week-chart-svg"
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Weekly signups trend by role"
        >
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

            {data.map((d, i) => {
                const total = d.count || 0;
                const emp = d.employee || 0;
                const adm = d.admin || 0;
                const x = toX(i);
                const isHover = hoveredIdx === i;

                /* Employee neeche, admin uske upar — dono milkir total
                   height banate hain. */
                const empH = (emp / max) * innerH;
                const admH = (adm / max) * innerH;
                const baseY = h - pad;
                const empY = baseY - empH;
                const admY = empY - admH;

                return (
                    <g
                        key={i}
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                    >
                        {/* Poora column ka invisible hit-area — hover
                            khali hisse par bhi mile, warna sirf 2px
                            bar par mouse rakhna padta. */}
                        <rect
                            x={pad + i * slot}
                            y={pad}
                            width={slot}
                            height={innerH}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                        />

                        {total === 0 && (
                            <rect
                                x={x}
                                y={baseY - 2}
                                width={barW}
                                height={2}
                                rx="1"
                                fill="#e2e8f0"
                            />
                        )}

                        {emp > 0 && (
                            <rect
                                x={x}
                                y={empY}
                                width={barW}
                                height={Math.max(empH, 2)}
                                rx={adm > 0 ? 0 : 4}
                                fill={ROLE_COLORS.EMPLOYEE}
                                opacity={isHover || hoveredIdx === null ? 1 : 0.45}
                                style={{ transition: "opacity 0.2s ease" }}
                            />
                        )}
                        {adm > 0 && (
                            <rect
                                x={x}
                                y={admY}
                                width={barW}
                                height={Math.max(admH, 2)}
                                rx="4"
                                fill={ROLE_COLORS.OWNER}
                                opacity={isHover || hoveredIdx === null ? 1 : 0.45}
                                style={{ transition: "opacity 0.2s ease" }}
                            />
                        )}
                    </g>
                );
            })}

            {/* Total count har bar ke upar. */}
            {data.map((d, i) => (
                <text
                    key={`v${i}`}
                    x={toX(i) + barW / 2}
                    y={toY(d.count || 0) - 10}
                    textAnchor="middle"
                    className="week-chart-value"
                    style={{ pointerEvents: "none" }}
                >
                    {d.count || 0}
                </text>
            ))}

            {hoveredIdx !== null && (
                <g style={{ pointerEvents: "none" }} className="chart-tooltip-group">
                    <rect
                        x={toX(hoveredIdx) + barW / 2 - 58}
                        y={toY(data[hoveredIdx].count || 0) - 74}
                        width="116"
                        height="62"
                        rx="10"
                        fill="#1e1b4b"
                        opacity="0.95"
                    />
                    <text
                        x={toX(hoveredIdx) + barW / 2}
                        y={toY(data[hoveredIdx].count || 0) - 55}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="12"
                        fontWeight="700"
                        fontFamily="Inter, sans-serif"
                    >
                        {data[hoveredIdx].label}
                    </text>
                    <circle
                        cx={toX(hoveredIdx) + barW / 2 - 26}
                        cy={toY(data[hoveredIdx].count || 0) - 33}
                        r="4"
                        fill={ROLE_COLORS.EMPLOYEE}
                    />
                    <text
                        x={toX(hoveredIdx) + barW / 2 - 18}
                        y={toY(data[hoveredIdx].count || 0) - 29}
                        textAnchor="start"
                        fill="rgba(255,255,255,0.85)"
                        fontSize="10.5"
                        fontFamily="Inter, sans-serif"
                    >
                        {data[hoveredIdx].employee || 0} employee
                    </text>
                    <circle
                        cx={toX(hoveredIdx) + barW / 2 - 26}
                        cy={toY(data[hoveredIdx].count || 0) - 18}
                        r="4"
                        fill={ROLE_COLORS.OWNER}
                    />
                    <text
                        x={toX(hoveredIdx) + barW / 2 - 18}
                        y={toY(data[hoveredIdx].count || 0) - 14}
                        textAnchor="start"
                        fill="rgba(255,255,255,0.85)"
                        fontSize="10.5"
                        fontFamily="Inter, sans-serif"
                    >
                        {data[hoveredIdx].admin || 0} admin
                    </text>
                </g>
            )}

            {data.map((d, i) => (
                <text
                    key={`l${i}`}
                    x={toX(i) + barW / 2}
                    y={h - 6}
                    textAnchor="middle"
                    className="week-chart-label"
                    style={{ pointerEvents: "none" }}
                >
                    {d.label}
                </text>
            ))}

            {/* Peak din ko highlight — total hi nahi, day bhi. */}
            {data[maxIdx]?.count > 0 && (
                <text
                    x={toX(maxIdx) + barW / 2}
                    y={toY(data[maxIdx].count) - 24}
                    textAnchor="middle"
                    style={{ pointerEvents: "none" }}
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#94a3b8"
                    fontFamily="Inter, sans-serif"
                >
                    peak
                </text>
            )}
        </svg>
    );
}

/* Chhota legend — bar chart ke neeche, do roles ka color mate. */
function RoleLegend() {
    return (
        <div className="donut-legend" style={{ justifyContent: "center", marginTop: 8 }}>
            {[
                { label: "Employee", color: ROLE_COLORS.EMPLOYEE },
                { label: "Admin", color: ROLE_COLORS.OWNER },
            ].map((l) => (
                <div className="legend-item" key={l.label}>
                    <span className="legend-dot" style={{ background: l.color }} />
                    <span className="legend-name">{l.label}</span>
                </div>
            ))}
        </div>
    );
}

// =========================
// ROLE DONUT (pure SVG ring)
// =========================

/* `ROLE_COLORS` upar define hai (chart components use karte hain). */

/* Raw breakdown ko chart-ready shape me badalta hai.

   Backend `OWNER`/`HR`/`EMPLOYEE` alag bhejta hai, lekin dashboard ka
   matlab hai "Admin vs Employee" — do hi pie slice, har ek apne color
   me. Agar as-is chhod dete to HR aur OWNER ke do alag slices ban jate
   ( dono same purple hue me, kuch bhi padhne layak nahi), aur 1 OWNER
   vs 16 EMPLOYEE ka pie lagbhag ek hi dikhta.

   `Admin` hamesha pehla slot leta hai taaki color usi role par stable
   rahe, chahe us week admin signup na bhi hua ho. */
const roleGroups = (breakdown) => {
    const groups = [
        { key: "admin", label: "Admin", color: ROLE_COLORS.OWNER, count: 0 },
        { key: "employee", label: "Employee", color: ROLE_COLORS.EMPLOYEE, count: 0 },
    ];
    for (const d of breakdown || []) {
        const key = String(d.role || "").toUpperCase();
        if (key === "OWNER" || key === "HR" || key === "ADMIN") groups[0].count += d.count;
        else groups[1].count += d.count;
    }
    /* Zero-count slice mat dikhao — warna 1 owner ke case me pie ka
       hafsa khaali dikhta hai aur "0%" label ghabra deta hai. */
    return groups.filter((g) => g.count > 0);
};

function RoleDonut({ breakdown }) {
    /* Raw `OWNER`/`HR`/`EMPLOYEE` rows ko sirf do slices (Admin/Employee)
       me fold karta hai. Caller bhi wahi `roleGroups` se legend banata hai,
       isiliye ring aur legend ke colors hamesha match karte hain. */
    const groups = roleGroups(breakdown);
    const total = groups.reduce((s, g) => s + g.count, 0);
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
                {groups.map((g, i) => {
                    const len = (g.count / total) * c;
                    const color = g.color;
                    const dashArray = `${len - 3} ${c - len + 3}`;
                    const rotate = (offset / c) * 360 - 90;
                    offset += len;
                    return (
                        <circle
                            key={g.key}
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
                        <p className="donut-hover-role" style={{ color: groups[hoveredIdx].color }}>
                            {groups[hoveredIdx].label}
                        </p>
                        <p className="donut-hover-count">
                            {groups[hoveredIdx].count} ({Math.round((groups[hoveredIdx].count / total) * 100)}%)
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
//
// `colors` diye jaate hain to wahi use hote hain (role chart), warna
// palette se cycle karte hain. Pehle har slice ko `CHART_COLORS[i % 6]`
// milta tha, jo role ke hisaab se stable nahi tha — ek hi role hamesha
// same index par rehta, lekin colors role se match nahi karte the.
function PieChart({ labels, values, colors }) {
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
                const color = (colors && colors[i]) || CHART_COLORS[i % CHART_COLORS.length];
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
        const week = weeklyTrend || [];
        const total = week.reduce((s, d) => s + (d.count || 0), 0);
        const adminTotal = week.reduce((s, d) => s + (d.admin || 0), 0);
        const empTotal = week.reduce((s, d) => s + (d.employee || 0), 0);
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
                        Har din ka bar do hisso me bana hai — neeche employee
                        aur upar admin, apne apne color me. Har bar ke upar
                        us din ka total likha hai, aur mouse rakhte hi din
                        ke saath dono counts bhi dikhte hain.
                    </p>
                    <div className="popup-chart-head">
                        <span className="popup-chart-title">Daily signups trend</span>
                        <span className="popup-chart-sub">Stacked by role</span>
                    </div>
                    <WeeklyChart data={week} />
                    <RoleLegend />
                    <div className="donut-legend" style={{ justifyContent: "center", marginTop: 6 }}>
                        <div className="legend-item">
                            <span className="legend-name">This week</span>
                            <span className="legend-count">
                                {total} total · {adminTotal} admin · {empTotal} employee
                            </span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (active === "role") {
        const groups = roleGroups(roleBreakdown);
        const total = groups.reduce((s, g) => s + g.count, 0);
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
                                Ye pie chart aapke saare members ko do bucket me
                                baanta hai — Admin (OWNER + HR) aur Employee. Har slice
                                ka apna color hai, aur neeche har bucket ka exact
                                count aur uska percentage diya gaya hai.
                            </p>
                            <PieChart
                                labels={groups.map((g) => g.label)}
                                values={groups.map((g) => g.count)}
                                colors={groups.map((g) => g.color)}
                            />
                            <div className="donut-legend">
                                {groups.map((g) => (
                                    <div className="legend-item" key={g.key}>
                                        <span
                                            className="legend-dot"
                                            style={{ background: g.color }}
                                        />
                                        <span className="legend-name">{g.label}</span>
                                        <span className="legend-count">
                                            {g.count} ({Math.round((g.count / total) * 100)}%)
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
        try {
            const { data: result } = await adminServ.getDashboard();

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
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const handleLogout = async () => {
        try {
            const storedUser = JSON.parse(localStorage.getItem("user") || "null");
            if (storedUser?.id) {
                await adminServ.logoutLog({ userId: storedUser.id });
            }
        } catch { }
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

        try {
            const { data: result } = await adminServ.deleteUser(deleteTarget.id);

            if (result?.message && !result?.success) {
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
                            <button type="button" className="dash-btn dash-btn-primary" onClick={() => navigate("/directory")}>
                                <Add fontSize="small" />
                                Add Employee
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
                                    <RoleLegend />
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
                                        {roleGroups(roleBreakdown).map((g) => (
                                            <div className="legend-item" key={g.key}>
                                                <span
                                                    className="legend-dot"
                                                    style={{ background: g.color }}
                                                />
                                                <span className="legend-name">{g.label}</span>
                                                <span className="legend-count">{g.count}</span>
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
                                        const role = u.role || "—";
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
                                    <span className="dash-role-chip">{viewUser.role || "—"}</span>
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
