import React from "react";
import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { AccessTimeOutlined } from "@mui/icons-material";

function WeeklyHoursMiniChart({ days = [], total = 0, loading = false }) {
    const maxHours = Math.max(...days.map((day) => day.hours), 1);

    return (
        <Card elevation={0} className="emp-home-chart">
            <CardContent>
                <Box className="emp-home-chart-head">
                    <Typography className="emp-home-chart-title">
                        <AccessTimeOutlined sx={{ fontSize: 17 }} />
                        Hours this week
                    </Typography>
                    {!loading && total > 0 && (
                        <span className="emp-home-chart-total">{total.toFixed(1)}h total</span>
                    )}
                </Box>

                {loading ? (
                    <Box className="emp-home-chart-bars">
                        {days.map((day) => (
                            <Box key={day.label} className="emp-home-chart-col">
                                <Skeleton variant="rounded" width="100%" height={42} sx={{ borderRadius: 1.5 }} />
                                <Skeleton variant="text" width={24} height={14} />
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Box className="emp-home-chart-bars">
                        {days.map((day) => {
                            const height = Math.max(4, Math.round((day.hours / maxHours) * 58));
                            return (
                                <Box key={day.label} className="emp-home-chart-col">
                                    <span className="emp-home-chart-value">
                                        {day.hours > 0 ? `${day.hours.toFixed(1)}h` : ""}
                                    </span>
                                    <span
                                        className={`emp-home-chart-bar${day.isToday ? " is-today" : ""}${day.hours > 0 ? " has-hours" : ""}`}
                                        style={{ height }}
                                    />
                                    <span className={`emp-home-chart-day${day.isToday ? " is-today" : ""}`}>
                                        {day.label}
                                    </span>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default WeeklyHoursMiniChart;
