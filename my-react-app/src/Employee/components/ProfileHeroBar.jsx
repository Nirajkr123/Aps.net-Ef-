import React, { memo, useRef } from "react";
import {
  Card, Box, Typography, Avatar, IconButton, Tooltip, Chip,
  LinearProgress, CircularProgress,
} from "@mui/material";
import {
  CheckCircle, RadioButtonUnchecked, CameraAltOutlined,
  WorkOutlineOutlined, BusinessOutlined,
} from "@mui/icons-material";

/* Banner ke andar ke translucent chips — gradient ke upar readable
   rahne ke liye halka white overlay + border. */
const infoChipSx = {
  bgcolor: "rgba(255,255,255,0.18)",
  color: "#ffffff",
  fontWeight: 600,
  border: "1px solid rgba(255,255,255,0.3)",
  "& .MuiChip-label": { px: 1 },
};

/* Chhota label + value jodi (Designation / Department ke liye) */
function MetaItem({ icon, label, value }) {
  if (!value) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      {icon}
      <Typography
        variant="caption"
        component="span"
        sx={{ fontWeight: 700, opacity: 0.95, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {label}: {value}
      </Typography>
    </Box>
  );
}

/* ------------------------------------------------------------------
   ProfileHeroBar — teeno tabs ke upar common green bar.

   Isko sirf `EmployeeProfile` (parent) render karta hai, step
   conditionals ke BAHAR — isliye tab switch par na remount hota hai
   na flicker. Saara state (steps, completion, photo) parent se props
   ke through aata hai, sirf file-input ka ref iske andar rehta hai.
   ------------------------------------------------------------------ */
function ProfileHeroBar({
  displayName,
  email,
  initials,
  profilePhotoUrl,
  photoUploading,
  onPhotoSelect,
  isProfileComplete,
  employee,
  role,
  steps,
  stepInfo,
  activeStep,
  onStepChange,
}) {
  const fileRef = useRef(null);

  const total = steps.length;
  const completed = stepInfo.reduce((n, s) => n + (s.done ? 1 : 0), 0);
  const percent = Math.round((completed / total) * 100);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onPhotoSelect(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="emp-prof-hero-sticky">
      <Card className="emp-prof-hero" sx={{ borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <Box
          className="emp-prof-banner"
          sx={{
            background: isProfileComplete
              ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
              : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            p: { xs: 2, sm: 3 },
            color: "white",
          }}
        >
        {/* ---------- Row 1: photo + identity + live progress ---------- */}
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 3 }, flexWrap: "wrap" }}>
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <Avatar
              sx={{
                width: { xs: 58, sm: 84 },
                height: { xs: 58, sm: 84 },
                fontSize: { xs: 22, sm: 32 },
                fontWeight: 700,
                bgcolor: "rgba(255,255,255,0.2)",
                border: "3px solid rgba(255,255,255,0.4)",
              }}
            >
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              ) : (
                initials
              )}
            </Avatar>
            <input
              type="file"
              ref={fileRef}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            <Tooltip title="Upload Photo">
              <IconButton
                size="small"
                onClick={() => fileRef.current?.click()}
                disabled={photoUploading}
                sx={{
                  position: "absolute", bottom: -4, right: -4,
                  bgcolor: "white", color: "#4f46e5", width: 30, height: 30,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  "&:hover": { bgcolor: "#f3f4f6" },
                }}
              >
                {photoUploading ? <CircularProgress size={14} color="inherit" /> : <CameraAltOutlined sx={{ fontSize: 17 }} />}
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                fontSize: { xs: 18, sm: 24 },
                lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </Typography>

            <Typography
              variant="body2"
              sx={{ opacity: 0.9, mt: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {email || "—"}
            </Typography>

            {/* Designation / department — banner me hamesha dikhte hain,
                tab switch par layout shift nahi hota */}
            <Box className="emp-prof-hero-meta" sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap" }}>
              <MetaItem icon={<WorkOutlineOutlined sx={{ fontSize: 15, opacity: 0.9 }} />} label="Designation" value={employee?.designationTitle} />
              <MetaItem icon={<BusinessOutlined sx={{ fontSize: 15, opacity: 0.9 }} />} label="Dept" value={employee?.departmentName} />
            </Box>

            <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
              {employee?.employeeCode && <Chip label={employee.employeeCode} size="small" sx={infoChipSx} />}
              <Chip label={role || "EMPLOYEE"} size="small" sx={infoChipSx} />
            </Box>
          </Box>

          {/* Live progress summary */}
          <Box className="emp-prof-hero-progress" sx={{ flexShrink: 0, minWidth: 210 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Step {activeStep + 1} of {total}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 18, sm: 20 }, lineHeight: 1.3 }}>
              {completed} of {total} complete
            </Typography>
            <LinearProgress
              variant="determinate"
              value={percent}
              aria-label={`${percent}% of profile steps complete`}
              sx={{
                height: 8, borderRadius: 4, mt: 0.75,
                bgcolor: "rgba(255,255,255,0.28)",
                "& .MuiLinearProgress-bar": { borderRadius: 4, backgroundColor: "#ffffff" },
              }}
            />
            <Typography variant="caption" component="p" sx={{ mt: 0.75, opacity: 0.9, lineHeight: 1.4 }}>
              {percent}% filled — keep going to finish your profile
            </Typography>
          </Box>
        </Box>

        {/* ---------- Row 2: 3-step progress + status ---------- */}
        <Box className="emp-prof-stepper" role="tablist" aria-label="Profile completion steps">
          {steps.map((step, idx) => {
            const info = stepInfo[idx] || { done: false, detail: "" };
            const isActive = activeStep === idx;
            return (
              <React.Fragment key={step}>
                {idx > 0 && (
                  <span
                    className={`emp-prof-step-line ${info.done ? "is-done" : ""}`}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`emp-prof-step ${isActive ? "is-active" : ""} ${info.done ? "is-done" : ""}`}
                  onClick={() => onStepChange(idx)}
                >
                  <span className="emp-prof-step-dot">
                    {info.done ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </span>
                  <span className="emp-prof-step-text">
                    <strong>{idx + 1}. {step}</strong>
                    <small>{info.detail}</small>
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </Box>
        </Box>
      </Card>
    </div>
  );
}

/* Tab switch par sirf `activeStep` badalta hai — photo/name/email/
   progress same rehte hain, isliye memo se render skip ho jaata hai. */
export default memo(ProfileHeroBar);
