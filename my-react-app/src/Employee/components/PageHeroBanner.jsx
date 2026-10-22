import React from "react";
import { Box, Chip, Typography } from "@mui/material";

/* =========================================================================
   PAGE HERO BANNER  —  shared by "My Attendance" aur "My Leaves"
   -------------------------------------------------------------------------
   Pehle har page apna alag header banata tha (Attendance me `.emp-hero`
   CSS, Leaves me apna `<Box>`). Ab dono ek hi component se aate hain, to
   styling ek jagah change hoti hai aur pages hamesha aapas me match karte
   hain.

   Props
   -----
   title    : string
   subtitle : string
   chips    : [{ label, variant, color }]
              variant → "text"   (plain bold text, e.g. "Last 6 months")
                        "outlined" (pill chip, default gray border)
                        "filled"  (solid pill chip)
              color   → MUI colour name, sirf outlined/filled ke liye
                        (e.g. "warning" → orange text + orange border)
   action   : optional ReactNode (usually a Button). Desktop par far right,
              mobile par poori width me, banner ke neeche.

   Height kabhi fix nahi hai — content ke hisaab se banner khud barhta hai,
   isliye koi text clip nahi hota.
   ========================================================================= */

function HeroChip({ chip }) {
    const { label, variant = "outlined", color } = chip;

    if (variant === "text") {
        return (
            <Typography
                sx={{ fontWeight: 700, fontSize: { xs: 12.5, md: 13.5 }, color: "#5b6478", whiteSpace: "nowrap" }}
            >
                {label}
            </Typography>
        );
    }

    return (
        <Chip
            label={label}
            size="small"
            variant={variant}
            color={color || "default"}
            sx={{
                height: 30,
                borderRadius: 999,
                fontWeight: 700,
                fontSize: { xs: 12, md: 12.5 },
                /* Default outlined chip: halka translucent white + gray border,
                   gradient ke upar bhi readable. */
                bgcolor: variant === "outlined" && !color ? "rgba(255,255,255,0.55)" : "transparent",
                borderColor: variant === "outlined" && !color ? "rgba(99,102,241,0.3)" : undefined,
                color: variant === "outlined" && !color ? "#2a2f4a" : undefined,
                "&.MuiChip-outlined": { borderColor: color ? `${color}.main` : "rgba(99,102,241,0.3)" },
            }}
        />
    );
}

function PageHeroBanner({ title, subtitle, chips = [], action }) {
    return (
        <Box
            className="page-hero-banner"
            sx={{
                position: "relative",
                overflow: "hidden",
                borderRadius: { xs: 4, md: 5 },
                border: "1px solid rgba(255,255,255,0.6)",
                background: [
                    /* Do soft blobs — ek upar-beeche, ek door right me */
                    "radial-gradient(circle at 45% 20%, rgba(139,120,255,0.18) 0, transparent 40%)",
                    "radial-gradient(circle at 92% 70%, rgba(120,110,255,0.28) 0, transparent 45%)",
                    "linear-gradient(135deg, #efeaff 0%, #e2dcff 50%, #dcd9ff 100%)",
                ].join(", "),
                boxShadow: "0 8px 24px rgba(99,91,255,0.15)",
                px: { xs: 2.5, md: 4 },
                py: { xs: 2, md: 3 },
                mb: { xs: 2.5, md: 3 },

                /* Dotted pattern overlay — gradient ke upar, content se pehle.
                   `pointerEvents: none` zaroori hai warna clicks button par na jaayein. */
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "radial-gradient(rgba(99,91,255,0.16) 1px, transparent 1.3px)",
                    backgroundSize: "24px 24px",
                    pointerEvents: "none",
                },
            }}
        >
            <Box
                sx={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: { xs: "stretch", md: "center" },
                    justifyContent: "space-between",
                    gap: { xs: 1.5, md: 2 },
                }}
            >
                {/* ---- Title + subtitle ---- */}
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontWeight: 800,
                            color: "#111133",
                            fontSize: { xs: 24, md: 32 },
                            lineHeight: 1.15,
                            letterSpacing: "-0.5px",
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography
                            sx={{
                                color: "text.secondary",
                                fontSize: { xs: 14, md: 16 },
                                mt: 0.5,
                                lineHeight: 1.4,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>

                {/* ---- Chips: desktop par title ke bagal, mobile par niche wrap ---- */}
                {chips.length > 0 && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 1,
                            flexShrink: 0,
                        }}
                    >
                        {chips.map((chip) => (
                            <HeroChip key={chip.label} chip={chip} />
                        ))}
                    </Box>
                )}

                {/* ---- Action slot ---- */}
                {action && (
                    <Box
                        sx={{
                            flexShrink: 0,
                            width: { xs: "100%", md: "auto" },
                            /* Action agar Button hai to mobile par poori width. */
                            "& > button": { width: { xs: "100%", md: "auto" } },
                        }}
                    >
                        {action}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

export default PageHeroBanner;
