import { env } from "../../config/env.js";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { attendanceLogs } from "../../db/schema.js";

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

interface LoginAttendanceLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
}

export async function ensureWorkerLoginAttendanceWithLocation(userId: string, location: LoginAttendanceLocation) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [existingCheckIn] = await db
    .select({ id: attendanceLogs.id })
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.userId, userId),
        eq(attendanceLogs.type, "check_in"),
        gte(attendanceLogs.capturedAt, twentyFourHoursAgo)
      )
    )
    .orderBy(desc(attendanceLogs.capturedAt))
    .limit(1);

  const capturedAt = location.capturedAt ? new Date(location.capturedAt) : new Date();

  if (existingCheckIn) {
    const [existingLog] = await db
      .select({
        id: attendanceLogs.id,
        latitude: attendanceLogs.latitude,
        longitude: attendanceLogs.longitude,
        metadata: attendanceLogs.metadata
      })
      .from(attendanceLogs)
      .where(eq(attendanceLogs.id, existingCheckIn.id))
      .limit(1);

    const metadataSource =
      typeof existingLog?.metadata === "object" && existingLog.metadata && "source" in existingLog.metadata
        ? String(existingLog.metadata.source)
        : "";

    const hasPlaceholderCoordinates = existingLog?.latitude === 0 && existingLog?.longitude === 0;

    if (existingLog && hasPlaceholderCoordinates && metadataSource.startsWith("auto_login_check_in")) {
      await db
        .update(attendanceLogs)
        .set({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters:
            location.accuracyMeters !== undefined ? String(Number(location.accuracyMeters.toFixed(2))) : null,
          capturedAt,
          metadata: {
            source: "auto_login_check_in_geolocated",
            note: "Upgraded login attendance with real browser coordinates."
          }
        })
        .where(eq(attendanceLogs.id, existingLog.id));

      return {
        marked: false,
        updatedExisting: true,
        capturedAt: capturedAt.toISOString()
      };
    }

    return {
      marked: false,
      updatedExisting: false,
      reason: "already_marked_within_24_hours"
    };
  }

  await db.insert(attendanceLogs).values({
    userId,
    type: "check_in",
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters:
      location.accuracyMeters !== undefined ? String(Number(location.accuracyMeters.toFixed(2))) : null,
    withinGeofence: false,
    driftScore: "0",
    capturedAt,
    deviceId: "login-auto-mark-geolocated",
    metadata: {
      source: "auto_login_check_in_geolocated",
      note: "Automatically marked on first worker login within a rolling 24-hour window using browser GPS."
    }
  });

  return {
    marked: true,
    updatedExisting: false,
    capturedAt: capturedAt.toISOString()
  };
}

export async function getAttendanceSummary(userId: string) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [summary] = await db
    .select({
      checkInsLast24Hours: sql<number>`count(*) filter (where ${attendanceLogs.type} = 'check_in' and ${attendanceLogs.capturedAt} >= ${twentyFourHoursAgo})`,
      presentDaysThisMonth: sql<number>`count(*) filter (where ${attendanceLogs.type} = 'check_in' and ${attendanceLogs.capturedAt} >= ${monthStart})`
    })
    .from(attendanceLogs)
    .where(eq(attendanceLogs.userId, userId));

  return {
    checkedInToday: Number(summary?.checkInsLast24Hours ?? 0) > 0,
    presentDaysThisMonth: Number(summary?.presentDaysThisMonth ?? 0)
  };
}
