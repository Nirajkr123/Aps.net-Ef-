import React, { useState } from "react";
import "./signup.css";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import API_URL from "../config/api";
import {
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import {
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    setErrors({
      ...errors,
      [name]: "",
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {
      newErrors.email = "Enter a valid email";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password =
        "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword =
        "Confirm password is required";
    } else if (
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword =
        "Passwords do not match";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // =========================
  // GOOGLE SIGNUP
  // =========================

  const handleGoogleSignup = async () => {
    setMessage({ type: "", text: "" });
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Get Firebase ID token
      const idToken = await user.getIdToken();

      // Send to backend
      const response = await fetch(`${API_URL}/api/User/firebase-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: idToken,
          firstName: user.displayName?.split(" ")[0] || "",
          lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({
          type: "error",
          text: data.message || "Google signup failed.",
        });
        return;
      }

      // Save token and user
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      setMessage({
        type: "success",
        text: "Google signup successful! Redirecting to login...",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      console.error("Google Signup Error:", error);
      if (error.code !== "auth/popup-closed-by-user") {
        setMessage({
          type: "error",
          text: "Google signup failed. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // EMAIL/PASSWORD SIGNUP
  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage({ type: "", text: "" });

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Step 2: Get Firebase ID token
      const idToken = await userCredential.user.getIdToken();

      // Step 3: Send to backend to store profile
      const response = await fetch(
        `${API_URL}/api/User/firebase-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idToken: idToken,
            firstName: formData.firstName,
            lastName: formData.lastName,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({
          type: "error",
          text: result.message || "Signup failed. Please try again.",
        });
        return;
      }

      // Step 4: Sign out from Firebase (user needs to login manually)
      await signOut(auth);

      setMessage({
        type: "success",
        text: "Signup successful! Redirecting to login...",
      });

      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      console.error("Signup Error:", error);

      let errorMessage = "Could not reach the server. Please check your connection and try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please login instead.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address.";
      }

      setMessage({
        type: "error",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="signup-page">
      <Container className="signup-container">
        <Paper
          className="signup-card"
          elevation={0}
        >
          {/* LEFT SIDE */}

          <Box className="signup-left">
            <Typography
              variant="h3"
              className="welcome-title"
            >
              Welcome
            </Typography>

            <Typography className="welcome-text">
              Create your account and
              <br />
              get started with us.
            </Typography>
          </Box>

          {/* DIVIDER */}

          <Box className="signup-divider" />

          {/* RIGHT SIDE */}

          <Box className="signup-right">
            <Typography
              variant="h4"
              className="signup-title"
            >
              Sign Up
            </Typography>

            <Typography className="signup-subtitle">
              Create your account
            </Typography>

            <Box
              component="form"
              onSubmit={handleSubmit}
              className="signup-form"
            >
              {/* FIRST + LAST NAME */}

              <Box className="name-row">
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={Boolean(errors.firstName)}
                  helperText={errors.firstName}
                />

                <TextField
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={Boolean(errors.lastName)}
                  helperText={errors.lastName}
                />
              </Box>

              {/* EMAIL */}

              <TextField
                fullWidth
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={Boolean(errors.email)}
                helperText={errors.email}
              />

              {/* PASSWORD */}

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={formData.password}
                onChange={handleChange}
                error={Boolean(errors.password)}
                helperText={errors.password}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="button"
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          onClick={() =>
                            setShowPassword((prev) => !prev)
                          }
                          onMouseDown={(e) =>
                            e.preventDefault()
                          }
                          edge="end"
                        >
                          {showPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />


              {/* CONFIRM PASSWORD */}

              <TextField
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={formData.confirmPassword}
                onChange={handleChange}
                error={Boolean(
                  errors.confirmPassword
                )}
                helperText={
                  errors.confirmPassword
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="button"
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          onClick={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          onMouseDown={(e) =>
                            e.preventDefault()
                          }
                          edge="end"
                        >
                          {showConfirmPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {/* MESSAGE */}

              {message.text && (
                <Typography
                  className={`signup-message ${message.type === "error"
                    ? "signup-message-error"
                    : "signup-message-success"
                    }`}
                >
                  {message.text}
                </Typography>
              )}

              {/* SIGN UP BUTTON */}

              <Button
                fullWidth
                type="submit"
                variant="contained"
                className="signup-button"
                disabled={loading}
              >
                {loading ? "Signing up..." : "Sign Up"}
              </Button>

              {/* DIVIDER */}

              <Box className="divider-line">
                <Box className="divider-text">OR</Box>
              </Box>

              {/* GOOGLE SIGNUP */}

              <Button
                fullWidth
                variant="outlined"
                className="google-button"
                onClick={handleGoogleSignup}
                disabled={loading}
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="google-icon"
                />
                Sign up with Google
              </Button>

              {/* LOGIN */}

              <Typography className="login-text">
                Already have an account?{" "}
                <Button
                  variant="text"
                  className="login-button"
                  onClick={() => navigate("/login")}
                >
                  Login
                </Button>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default Signup;
