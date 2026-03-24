import { env } from "../../config/env.js";

export interface AttendancePayload {
  latitude: number;
  longitude: number;
  capturedAt: string;
  accuracyMeters?: number;
  geofence: {
    type: "radius";
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
  };
  previousPoint?: {
    latitude: number;
    longitude: number;
    capturedAt: string;
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const earthRadius = 6371000;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const alpha =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(alpha), Math.sqrt(1 - alpha));
}

export function validateAttendance(payload: AttendancePayload) {
  const { latitude, longitude, geofence, previousPoint, capturedAt } = payload;
  const distance = calculateDistanceMeters(latitude, longitude, geofence.centerLat, geofence.centerLng);
  const withinGeofence = distance <= geofence.radiusMeters;

  let driftScore = 0;
  if (previousPoint) {
    driftScore = calculateDistanceMeters(
      latitude,
      longitude,
      previousPoint.latitude,
      previousPoint.longitude
    );
  }

  const isTimestampFresh = Math.abs(Date.now() - new Date(capturedAt).getTime()) <= 5 * 60 * 1000;
  const isDriftValid = driftScore <= env.ATTENDANCE_MAX_DRIFT_METERS;

  return {
    withinGeofence,
    geofenceDistanceMeters: Number(distance.toFixed(2)),
    driftScore: Number(driftScore.toFixed(2)),
    flags: {
      timestampFresh: isTimestampFresh,
      driftValid: isDriftValid
    },
    accepted: withinGeofence && isTimestampFresh && isDriftValid
  };
}

export const attendanceSqlExamples = {
  radiusCheck: `
SELECT
  g.id,
  ST_Distance(
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    ST_SetSRID(ST_MakePoint(g.center_lng, g.center_lat), 4326)::geography
  ) AS distance_meters
FROM geofences g
WHERE g.type = 'radius'
  AND ST_DWithin(
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    ST_SetSRID(ST_MakePoint(g.center_lng, g.center_lat), 4326)::geography,
    g.radius_meters
  );
`,
  polygonCheck: `
SELECT g.id
FROM geofences g
WHERE g.type = 'polygon'
  AND ST_Within(
    ST_SetSRID(ST_MakePoint($1, $2), 4326),
    ST_GeomFromGeoJSON(g.polygon_geojson::text)
  );
`
};
