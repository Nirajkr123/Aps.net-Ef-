import React, { useState } from "react";
import "./forgot-password.css";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { LockReset } from "@mui/icons-material";
import { sendPasswordResetEmail } from "../firebase";
import { auth } from "../firebase";

function ForgotPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setEmailError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email");
      return;
    }

    setLoading(true);

    try {
      // Use Firebase to send password reset email
      await sendPasswordResetEmail(auth, email.trim());

      setMessage({
        type: "success",
        text: `Reset link sent to ${email.trim()}! Check your inbox.`,
      });

      setEmail("");
    } catch (error) {
      console.error("Forgot Password Error:", error);

      let errorMessage = "Something went wrong. Please try again.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      }

      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="forgot-page">
      <Container className="forgot-container">
        <Paper className="forgot-card" elevation={0}>
          {/* LEFT SIDE */}
          <Box className="forgot-left">
            <LockReset className="forgot-icon" />
            <Typography variant="h3" className="welcome-title">
              Forgot Password?
            </Typography>
            <Typography className="welcome-text">
              No worries! Enter your email and
              <br />
              we'll send you a reset link.
            </Typography>
          </Box>

          <Box className="forgot-divider" />

          {/* RIGHT SIDE */}
          <Box className="forgot-right">
            <Typography variant="h4" className="forgot-title">
              Reset Password
            </Typography>
            <Typography className="forgot-subtitle">
              Enter your email to receive a reset link
            </Typography>

            <Box component="form" onSubmit={handleSubmit} className="forgot-form">
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                error={Boolean(emailError)}
                helperText={emailError}
              />

              {message.text && (
                <Typography
                  className={`forgot-message ${
                    message.type === "error"
                      ? "forgot-message-error"
                      : "forgot-message-success"
                  }`}
                >
                  {message.text}
                </Typography>
              )}

              <Button
                fullWidth
                type="submit"
                variant="contained"
                className="forgot-button-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <CircularProgress
                      size={22}
                      sx={{ color: "white", mr: 1 }}
                    />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <Typography className="back-text">
                Remember your password?{" "}
                <Button
                  variant="text"
                  className="back-button"
                  onClick={() => navigate("/login")}
                >
                  Back to Login
                </Button>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default ForgotPassword;
