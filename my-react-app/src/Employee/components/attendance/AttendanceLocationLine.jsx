import React from "react";
import { LocationOnOutlined } from "@mui/icons-material";
import { getMapUrl } from "../../../utils/geolocation";

function AttendanceLocationLine({ record, fallback = "Location not recorded", className = "" }) {
    const locationName = record?.checkInLocationName
        || record?.checkOutLocationName
        || record?.location
        || fallback;

    const latitude = record?.checkInLatitude ?? record?.checkOutLatitude;
    const longitude = record?.checkInLongitude ?? record?.checkOutLongitude;
    const mapUrl = getMapUrl(latitude, longitude);

    return (
        <div className={`emp-att-location ${className}`.trim()}>
            <LocationOnOutlined aria-hidden="true" />
            <span>{locationName}</span>
            {mapUrl && (
                <>
                    <span className="emp-att-location-dot" aria-hidden="true">·</span>
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                        View on map
                    </a>
                </>
            )}
        </div>
    );
}

export default AttendanceLocationLine;
