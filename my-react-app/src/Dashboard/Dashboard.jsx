import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        padding: "30px",
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
        Welcome, {user?.firstName || user?.email || "User"}!
      </Typography>
      <Typography sx={{ mb: 4, color: "rgba(255,255,255,0.9)" }}>
        You have successfully logged in.
      </Typography>
      <Button
        variant="contained"
        onClick={handleLogout}
        sx={{ backgroundColor: "#4f46e5", "&:hover": { backgroundColor: "#4338ca" } }}
      >
        Logout
      </Button>
    </Box>
  );
}

export default Dashboard;
