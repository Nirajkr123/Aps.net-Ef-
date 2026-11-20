import React from "react";
import { Box, Paper, Typography } from "@mui/material";

export const SHIFT_PALETTES = {
  morning: {
    name: "Morning",
    main: "#f59e0b",
    dark: "#b45309",
    soft: "#fffbeb",
    glow: "rgba(245, 158, 11, 0.32)",
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    hero: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 52%, #f43f5e 100%)",
  },
  day: {
    name: "Day",
    main: "#3b82f6",
    dark: "#1d4ed8",
    soft: "#eff6ff",
    glow: "rgba(59, 130, 246, 0.32)",
    gradient: "linear-gradient(135deg, #38bdf8, #3b82f6)",
    hero: "linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #6366f1 100%)",
  },
  evening: {
    name: "Evening",
    main: "#f43f5e",
    dark: "#be123c",
    soft: "#fff1f2",
    glow: "rgba(244, 63, 94, 0.32)",
    gradient: "linear-gradient(135deg, #fb7185, #f43f5e)",
    hero: "linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #764ba2 100%)",
  },
  night: {
    name: "Night",
    main: "#8b5cf6",
    dark: "#6d28d9",
    soft: "#f5f3ff",
    glow: "rgba(139, 92, 246, 0.35)",
    gradient: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    hero: "linear-gradient(135deg, #6366f1 0%, #764ba2 60%, #4c1d95 100%)",
  },
};

export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #38bdf8, #3b82f6)",
  "linear-gradient(135deg, #34d399, #10b981)",
  "linear-gradient(135deg, #f59e0b, #f43f5e)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #fb7185, #764ba2)",
];

const pad = (value) => String(value).padStart(2, "0");

export const timeText = (value) => {
  if (!value) return "—";
  const text = String(value);
  return text.length >= 5 ? text.slice(0, 5) : text;
};

export const parseTimeHours = (value) => {
  const [hours, minutes] = timeText(value).split(":").map(Number);
  if (!Number.isFinite(hours)) return 0;
  return hours + (Number.isFinite(minutes) ? minutes / 60 : 0);
};

export const getShiftPalette = (shift) => {
  if (!shift) return SHIFT_PALETTES.day;
  const hour = parseTimeHours(shift.startTime || "06:00");
  if (shift.crossesMidnight || hour >= 18 || hour < 5) return SHIFT_PALETTES.night;
  if (hour < 11) return SHIFT_PALETTES.morning;
  if (hour < 17) return SHIFT_PALETTES.day;
  return SHIFT_PALETTES.evening;
};

export const getTimelineSegments = (shift) => {
  const duration = Math.min(Math.max(Number(shift?.durationHours) || 0, 0), 24);
  let cursor = parseTimeHours(shift?.startTime || "00:00") % 24;
  let remaining = duration;
  const segments = [];

  while (remaining > 0.001) {
    const length = Math.min(remaining, 24 - cursor);
    if (length > 0) {
      segments.push({
        left: (cursor / 24) * 100,
        width: (length / 24) * 100,
      });
    }
    remaining -= length;
    cursor = 0;
  }

  return segments;
};

export const computeShiftWindow = (startTime, durationHours) => {
  const duration = Math.max(0, Math.min(Number(durationHours) || 0, 23.99));
  const total = parseTimeHours(startTime) + duration;
  const endHours = ((total % 24) + 24) % 24;
  const totalMinutes = Math.round(endHours * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    start: timeText(startTime || "00:00"),
    end: `${pad(hours)}:${pad(minutes)}`,
    duration,
    crossesMidnight: total >= 24,
  };
};

export const toInputDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatDate = (value) => {
  const text = value ? String(value).slice(0, 10) : "";
  const parts = text.split("-");
  if (parts.length !== 3) return text || "—";
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${formatDate(toInputDate(date))} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getInitials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

export const getAvatarGradient = (employee) => {
  const source = `${employee?.id ?? ""}${employee?.firstName ?? ""}${employee?.employeeCode ?? ""}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

export const heroButtonSx = {
  color: "#fff",
  borderColor: "rgba(255,255,255,0.45)",
  bgcolor: "rgba(255,255,255,0.14)",
  textTransform: "none",
  fontWeight: 700,
  borderRadius: 2.5,
  backdropFilter: "blur(6px)",
  "&:hover": {
    bgcolor: "rgba(255,255,255,0.24)",
    borderColor: "#fff",
  },
};

export const heroSolidButtonSx = {
  bgcolor: "#fff",
  color: "#312e81",
  textTransform: "none",
  fontWeight: 800,
  borderRadius: 2.5,
  boxShadow: "0 14px 26px -14px rgba(15,23,42,0.65)",
  "&:hover": { bgcolor: "#f8fafc" },
};

export const gradientButtonSx = (palette = SHIFT_PALETTES.day) => ({
  background: palette.gradient,
  color: "#fff",
  textTransform: "none",
  fontWeight: 800,
  borderRadius: 2.5,
  boxShadow: `0 14px 28px -14px ${palette.glow}`,
  transition: "transform 0.18s ease, box-shadow 0.18s ease",
  "&:hover": {
    background: palette.gradient,
    transform: "translateY(-2px)",
    boxShadow: `0 18px 34px -14px ${palette.glow}`,
  },
  "&.Mui-disabled": {
    background: "#e5e7eb",
    color: "#9ca3af",
    boxShadow: "none",
  },
});

export function ShiftHero({ eyebrow, title, subtitle, icon: Icon, stats = [], actions, gradient }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        p: { xs: 2.5, md: 3.5 },
        color: "#fff",
        background: gradient || SHIFT_PALETTES.day.hero,
        boxShadow: "0 24px 50px -28px rgba(79,70,229,0.75)",
        "&::before": {
          content: '""',
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          top: -120,
          right: -60,
          background: "rgba(255,255,255,0.14)",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          bottom: -100,
          left: "38%",
          background: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2.5,
          alignItems: { md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 58,
              height: 58,
              borderRadius: 3,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.35)",
              backdropFilter: "blur(8px)",
            }}
          >
            {Icon && <Icon sx={{ fontSize: 30 }} />}
          </Box>
          <Box>
            {eyebrow && (
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.6, opacity: 0.78, fontWeight: 700 }}
              >
                {eyebrow}
              </Typography>
            )}
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ opacity: 0.82, mt: 0.5, maxWidth: 560 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {actions && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {actions}
          </Box>
        )}
      </Box>

      {stats.length > 0 && (
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", sm: "repeat(3, max-content)" },
            gap: 1,
            mt: 2.5,
          }}
        >
          {stats.map((stat) => (
            <Box
              key={stat.label}
              sx={{
                px: 1.5,
                py: 0.9,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.24)",
                backdropFilter: "blur(8px)",
                minWidth: 96,
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.72, display: "block" }}>
                {stat.label}
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 19, lineHeight: 1.15 }}>
                {stat.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

export function ShiftStatCard({ label, value, hint, icon: Icon, color = "#6366f1", bg = "#eef2ff" }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid #eef0f6",
        background: `linear-gradient(150deg, #ffffff 35%, ${bg})`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 18px 32px -24px ${color}`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ color: "#64748b", fontWeight: 800, letterSpacing: 0.4 }}
          >
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#171b2e", lineHeight: 1.1 }}>
            {value}
          </Typography>
          {hint && (
            <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.25 }}>
              {hint}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${bg}, #ffffff)`,
            border: `1px solid ${color}22`,
            boxShadow: `inset 0 0 0 1px #ffffff`,
          }}
        >
          {Icon && <Icon sx={{ color, fontSize: 24 }} />}
        </Box>
      </Box>
    </Paper>
  );
}

export function ShiftTimeline({ shift, palette, showLabels = false, height = 8 }) {
  const segments = getTimelineSegments(shift);

  return (
    <Box>
      <Box
        sx={{
          position: "relative",
          height,
          borderRadius: 99,
          bgcolor: "#eef2ff",
          overflow: "hidden",
          boxShadow: "inset 0 1px 2px rgba(30,41,59,0.08)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent calc(25% - 1px), rgba(99,102,241,0.14) calc(25% - 1px), rgba(99,102,241,0.14) 25%)",
          }}
        />
        {segments.map((segment, index) => (
          <Box
            key={index}
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${segment.left}%`,
              width: `${segment.width}%`,
              background: palette.gradient,
              borderRadius: 99,
              boxShadow: `0 0 12px ${palette.glow}`,
            }}
          />
        ))}
      </Box>
      {showLabels && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
          {["00:00", "06:00", "12:00", "18:00", "24:00"].map((label) => (
            <Typography key={label} variant="caption" sx={{ color: "#94a3b8", fontSize: 10 }}>
              {label}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
