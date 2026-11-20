import React, { useState } from "react";
import { IconButton, Menu, MenuItem, Skeleton } from "@mui/material";
import { MoreHorizRounded } from "@mui/icons-material";

import "./adminUi.css";

function CardMenu({ actions, label }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClose = () => setAnchorEl(null);
    const handleSelect = (action) => {
        handleClose();
        action.onClick?.();
    };

    return (
        <>
            <IconButton
                size="small"
                aria-label={label || "More actions"}
                aria-haspopup="menu"
                aria-expanded={open ? "true" : undefined}
                onClick={(event) => setAnchorEl(event.currentTarget)}
                sx={{ width: 44, height: 44, borderRadius: "10px" }}
            >
                <MoreHorizRounded fontSize="small" />
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
                {actions.map((action) => {
                    const Icon = action.icon;

                    return (
                        <MenuItem
                            key={action.key || action.label}
                            onClick={() => handleSelect(action)}
                            disabled={action.disabled}
                            sx={{
                                gap: 1.25,
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: action.tone === "danger" ? "#B42318" : "#171B2E",
                            }}
                        >
                            {Icon && <Icon fontSize="small" />}
                            {action.label}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}

export function MobileCard({
    title,
    subtitle,
    badge,
    fields = [],
    actions = [],
    onClick,
    ariaLabel,
}) {
    const interactive = typeof onClick === "function";

    return (
        <article
            className={`admin-mobile-card${interactive ? " is-clickable" : ""}`}
            onClick={onClick}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={ariaLabel || title}
            onKeyDown={
                interactive
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onClick(event);
                          }
                      }
                    : undefined
            }
        >
            <div className="admin-mobile-card-head">
                <div className="admin-mobile-card-copy">
                    <h3>{title}</h3>
                    {subtitle && <p className="admin-mobile-card-sub">{subtitle}</p>}
                </div>

                <div className="admin-mobile-card-head-right">
                    {badge}
                    {actions.length > 0 && (
                        <CardMenu actions={actions} label={`Actions for ${title}`} />
                    )}
                </div>
            </div>

            {fields.length > 0 && (
                <dl className="admin-mobile-fields">
                    {fields.map((field) => (
                        <div key={field.label}>
                            <dt>{field.label}</dt>
                            <dd>{field.value ?? "—"}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </article>
    );
}

function MobileCardList({
    items = [],
    getKey,
    renderItem,
    onLoadMore,
    hasMore = false,
    loadingMore = false,
    loading = false,
    skeletonCount = 3,
    empty,
}) {
    return (
        <div className="admin-mobile-list">
            {loading
                ? Array.from({ length: skeletonCount }).map((_, index) => (
                      <div
                          className="admin-mobile-card admin-mobile-skeleton"
                          key={`mobile-skeleton-${index}`}
                          aria-hidden="true"
                      >
                          <Skeleton variant="text" width="55%" height={22} />
                          <Skeleton variant="text" width="82%" height={16} />
                          <div className="admin-mobile-skeleton-fields">
                              <Skeleton variant="rounded" height={34} />
                              <Skeleton variant="rounded" height={34} />
                          </div>
                      </div>
                  ))
                : items.map((item, index) => (
                      <React.Fragment key={getKey ? getKey(item, index) : item?.id ?? index}>
                          {renderItem(item, index)}
                      </React.Fragment>
                  ))}

            {!loading && items.length === 0 && empty}

            {!loading && hasMore && (
                <button
                    type="button"
                    className="admin-mobile-loadmore"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                >
                    {loadingMore ? "Loading…" : "Load more"}
                </button>
            )}
        </div>
    );
}

export default MobileCardList;
