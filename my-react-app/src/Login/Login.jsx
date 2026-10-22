import React, { useState } from "react";

import {
    Box,
    Button,
    Container,
    IconButton,
    InputAdornment,
    Paper,
    TextField,
    Typography,
    CircularProgress,
} from "@mui/material";

import {
    Visibility,
    VisibilityOff,
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

import "./login.css";

function Login() {
    const navigate = useNavigate();

    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const [message, setMessage] = useState({
        type: "",
        text: "",
    });

    // =========================
    // HANDLE CHANGE
    // =========================

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

        setMessage({
            type: "",
            text: "",
        });
    };

    // =========================
    // VALIDATION
    // =========================

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        }

        if (!formData.password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;
    };

    // =========================
    // GOOGLE LOGIN
    // =========================

    const handleGoogleLogin = async () => {
        setMessage({ type: "", text: "" });
        setLoading(true);

        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Get Firebase ID token
            const idToken = await user.getIdToken();

            // Send to backend
            const response = await fetch("/api/User/firebase-login", {
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
                    text: data.message || "Google login failed.",
                });
                return;
            }

            if (data.token) {
                localStorage.setItem("token", data.token);
            }

            if (data.user) {
                localStorage.setItem("user", JSON.stringify(data.user));
            }

            setMessage({
                type: "success",
                text: "Google login successful!",
            });

            setTimeout(() => {
                navigate("/dashboard");
            }, 1000);
        } catch (error) {
            console.error("Google Login Error:", error);
            if (error.code !== "auth/popup-closed-by-user") {
                setMessage({
                    type: "error",
                    text: "Google login failed. Please try again.",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // =========================
    // EMAIL/PASSWORD LOGIN
    // =========================

    const handleSubmit = async (e) => {
        e.preventDefault();

        setMessage({ type: "", text: "" });

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            // Step 1: Try direct backend login (for HR-created employees)
            const directRes = await fetch("/api/User/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email.trim(),
                    password: formData.password,
                }),
            });

            const directResult = await directRes.json().catch(() => ({}));

            if (directRes.ok && directResult.token) {
                // Direct login succeeded
                if (directResult.token) localStorage.setItem("token", directResult.token);
                if (directResult.user) localStorage.setItem("user", JSON.stringify(directResult.user));

                setMessage({ type: "success", text: directResult.message || "Login successful!" });

                setTimeout(() => {
                    const role = directResult.user?.role;
                    if (role === "EMPLOYEE") navigate("/my-dashboard");
                    else navigate("/dashboard");
                }, 1000);
                return;
            }

            // Step 2: Direct login failed — fallback to Firebase login
            const userCredential = await signInWithEmailAndPassword(
                auth,
                formData.email.trim(),
                formData.password
            );

            const idToken = await userCredential.user.getIdToken();

            const response = await fetch("/api/User/firebase-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: idToken }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                setMessage({
                    type: "error",
                    text: result.message || "Invalid email or password",
                });
                return;
            }

            if (result.token) localStorage.setItem("token", result.token);
            if (result.user) localStorage.setItem("user", JSON.stringify(result.user));

            setMessage({ type: "success", text: result.message || "Login successful!" });

            setTimeout(() => {
                const role = result.user?.role;
                if (role === "EMPLOYEE") navigate("/my-dashboard");
                else navigate("/dashboard");
            }, 1000);

        } catch (error) {
            console.error("Login Error:", error);

            let errorMessage = "Server se connection nahi ho pa raha. Backend check karo.";

            if (error.code === "auth/user-not-found") {
                errorMessage = "No account found with this email. Please sign up first.";
            } else if (error.code === "auth/wrong-password") {
                errorMessage = "Incorrect password. Please try again.";
            } else if (error.code === "auth/invalid-email") {
                errorMessage = "Invalid email address.";
            } else if (error.code === "auth/too-many-requests") {
                errorMessage = "Too many failed attempts. Please try again later.";
            } else if (error.code === "auth/invalid-credential") {
                errorMessage = "Invalid email or password.";
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
        <Box className="login-page">

            <Container className="login-container">

                <Paper
                    className="login-card"
                    elevation={0}
                >

                    {/* LEFT SIDE */}

                    <Box className="login-left">

                        <Typography
                            variant="h3"
                            className="welcome-title"
                        >
                            Welcome Back
                        </Typography>

                        <Typography
                            className="welcome-text"
                        >
                            Login to your account and
                            <br />
                            continue your journey with us.
                        </Typography>

                    </Box>


                    {/* DIVIDER */}

                    <Box className="login-divider" />


                    {/* RIGHT SIDE */}

                    <Box className="login-right">

                        <Typography
                            variant="h4"
                            className="login-title"
                        >
                            Login
                        </Typography>

                        <Typography
                            className="login-subtitle"
                        >
                            Welcome back! Please login to
                            your account.
                        </Typography>


                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            className="login-form"
                        >

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
                                type={showPassword ? "text" : "password"}
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


                            {/* ERROR / SUCCESS */}

                            {message.text && (
                                <Typography
                                    sx={{
                                        padding: "12px",
                                        borderRadius: "8px",
                                        backgroundColor:
                                            message.type === "error"
                                                ? "#ffebee"
                                                : "#e8f5e9",
                                        color:
                                            message.type === "error"
                                                ? "#d32f2f"
                                                : "#2e7d32",
                                    }}
                                >
                                    {message.text}
                                </Typography>
                            )}


                            {/* LOGIN BUTTON */}

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                disabled={loading}
                                className="login-submit-button"
                            >

                                {loading ? (
                                    <>
                                        <CircularProgress
                                            size={22}
                                            sx={{
                                                color: "white",
                                                mr: 1,
                                            }}
                                        />

                                        Logging in...
                                    </>
                                ) : (
                                    "Login"
                                )}

                            </Button>

                            {/* DIVIDER */}

                            <Box className="divider-line">
                                <Box className="divider-text">OR</Box>
                            </Box>

                            {/* GOOGLE LOGIN */}

                            <Button
                                fullWidth
                                variant="outlined"
                                className="google-button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                            >
                                <img
                                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                    alt="Google"
                                    className="google-icon"
                                />
                                Login with Google
                            </Button>

                            {/* FORGOT PASSWORD */}
                            <Typography className="forgot-text">
                                <Button
                                    type="button"
                                    variant="text"
                                    className="forgot-link"
                                    onClick={() =>
                                        navigate("/forgot-password")
                                    }
                                >
                                    Forgot Password?
                                </Button>
                            </Typography>

                            {/* SIGNUP */}

                            <Typography
                                className="signup-text"
                            >
                                Don't have an account?{" "}

                                <Button
                                    type="button"
                                    variant="text"
                                    className="signup-link"
                                    onClick={() =>
                                        navigate("/signup")
                                    }
                                >
                                    Sign Up
                                </Button>

                            </Typography>

                        </Box>

                    </Box>

                </Paper>

            </Container>

        </Box>
    );
}

export default Login;
