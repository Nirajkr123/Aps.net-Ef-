import { Box, IconButton, Link, Tooltip, Typography } from "@mui/material";
import { LocationOnOutlined } from "@mui/icons-material";
import { getMapUrl } from "../utils/geolocation";

export default function AttendanceMapLink({
  latitude,
  longitude,
  accuracy,
  distanceMeters,
  locationName,
  label = "Open location in Google Maps",
  showDetails = false,
}) {
  const href = getMapUrl(latitude, longitude);
  if (!href) {
    if (!showDetails) return null;
    return (
      <Typography variant="caption" sx={{ color: "text.disabled" }}>
        Location not recorded
      </Typography>
    );
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  const acc = accuracy != null ? Number(accuracy) : null;
  const dist = distanceMeters != null ? Number(distanceMeters) : null;
  const hasDist = dist != null && Number.isFinite(dist);

  if (showDetails) {
    return (
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0 }}>
        <LocationOnOutlined sx={{ fontSize: 18, color: "info.main", mt: 0.15, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.3, wordBreak: "break-word" }}
          >
            {locationName || "Location recorded"}
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.15, mt: 0.15 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
              {lat.toFixed(6)}, {lng.toFixed(6)}
              {acc != null && Number.isFinite(acc) ? ` (±${Math.round(acc)} m)` : ""}
            </Typography>
            {hasDist && (
              <Typography variant="caption" sx={{ color: "info.main", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(dist)} m from work location
              </Typography>
            )}
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              variant="caption"
              underline="hover"
              aria-label={label}
              sx={{ fontWeight: 700, color: "info.main" }}
            >
              View on map
            </Link>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Tooltip title={label}>
      <IconButton
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        aria-label={label}
        sx={{
          p: 0.25,
          ml: 0.25,
          color: "info.main",
          verticalAlign: "middle",
          "&:hover": { bgcolor: "info.50" },
        }}
      >
        <LocationOnOutlined sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}
