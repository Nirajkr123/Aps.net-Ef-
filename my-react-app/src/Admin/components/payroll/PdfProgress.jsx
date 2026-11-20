import React from "react";
import { Button, LinearProgress } from "@mui/material";
import { RefreshRounded } from "@mui/icons-material";

function PdfProgress({ progress, onRefresh }) {
    if (!progress?.visible) return null;

    const percent = progress.total > 0
        ? Math.min(100, Math.round((progress.succeeded / progress.total) * 100))
        : 0;

    return (
        <section className="payroll-pdf-progress" aria-label="PDF generation progress">
            <div className="payroll-pdf-head">
                <div>
                    <h2>PDF generation</h2>
                    <p>
                        {progress.succeeded} of {progress.total} ready
                        {progress.active > 0 ? ` · ${progress.active} processing` : ""}
                        {progress.failed > 0 ? ` · ${progress.failed} failed` : ""}
                    </p>
                </div>
                {progress.failed > 0 && (
                    <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshRounded />}
                        onClick={onRefresh}
                        className="payroll-secondary-btn"
                    >
                        Retry
                    </Button>
                )}
            </div>
            <LinearProgress
                variant="determinate"
                value={percent}
                className="payroll-pdf-bar"
            />
        </section>
    );
}

export default PdfProgress;
