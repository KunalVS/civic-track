import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { geofences } from "../../db/schema.js";

export async function listGeofences(wardId?: string) {
  const rows = await db
    .select({
      id: geofences.id,
      name: geofences.name,
      wardId: geofences.wardId,
      centerLat: geofences.centerLat,
      centerLng: geofences.centerLng,
      radiusMeters: geofences.radiusMeters,
      type: geofences.type
    })
    .from(geofences)
    .where(wardId ? eq(geofences.wardId, wardId) : undefined)
    .orderBy(desc(geofences.createdAt));

  return rows
    .filter((row) => row.centerLat !== null && row.centerLng !== null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      wardId: row.wardId ?? "",
      center: [row.centerLat as number, row.centerLng as number] as [number, number],
      radiusMeters: Number(row.radiusMeters ?? 0),
      type: "radius" as const
    }));
}
