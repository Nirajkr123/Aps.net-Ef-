import React, { useId } from "react";
import { CloseRounded, SearchRounded } from "@mui/icons-material";

import "./adminUi.css";

function SearchInput({
    value = "",
    onChange,
    placeholder = "Search...",
    ariaLabel = "Search",
    onClear,
}) {
    const inputId = useId();

    return (
        <div className="admin-search">
            <label htmlFor={inputId} className="admin-sr-only">
                {ariaLabel}
            </label>
            <span className="admin-search-icon" aria-hidden="true">
                <SearchRounded fontSize="small" />
            </span>
            <input
                id={inputId}
                type="search"
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange?.(event.target.value)}
                autoComplete="off"
            />
            {value && (
                <button
                    type="button"
                    className="admin-search-clear"
                    aria-label="Clear search"
                    onClick={() => (onClear ? onClear() : onChange?.(""))}
                >
                    <CloseRounded sx={{ fontSize: 18 }} />
                </button>
            )}
        </div>
    );
}

export default SearchInput;
