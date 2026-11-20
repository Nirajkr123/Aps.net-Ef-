const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const GEOLOCATION_MESSAGES = {
  1: "Location permission denied. Please allow location access in your browser settings and try again.",
  2: "Your location is unavailable right now. Please try again.",
  3: "Getting your location timed out. Please try again.",
};

export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
      },
      (error) => {
        const message =
          GEOLOCATION_MESSAGES[error?.code] ||
          "Unable to get your location. Please try again.";
        const locationError = new Error(message);
        locationError.code = error?.code;
        reject(locationError);
      },
      GEOLOCATION_OPTIONS
    );
  });
}

export function hasCoordinates(latitude, longitude) {
  if (latitude === null || latitude === undefined || latitude === "") return false;
  if (longitude === null || longitude === undefined || longitude === "") return false;

  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function getMapUrl(latitude, longitude) {
  if (!hasCoordinates(latitude, longitude)) return null;
  return `https://www.google.com/maps?q=${Number(latitude)},${Number(longitude)}`;
}
