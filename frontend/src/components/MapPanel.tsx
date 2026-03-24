import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

interface WorkerLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  lastSeenAt: string;
}

interface GeofenceItem {
  id: string;
  name: string;
  center: [number, number];
  radiusMeters: number;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  geofenceId: string | null;
  assignedWorkerName: string;
}

export function MapPanel({
  workers,
  geofences,
  tasks,
  selectedGeofenceId
}: {
  workers: WorkerLocation[];
  geofences: GeofenceItem[];
  tasks?: TaskItem[];
  selectedGeofenceId?: string | null;
}) {
  const selectedGeofence = geofences.find((geofence) => geofence.id === selectedGeofenceId);
  const mapCenter =
    selectedGeofence?.center ??
    (workers[0] ? [workers[0].latitude, workers[0].longitude] : undefined) ??
    geofences[0]?.center ??
    ([15.9043, 73.8217] as [number, number]);

  return (
    <section className="panel map-panel">
      <div className="panel-header">
        <h2>Live Workforce Map</h2>
        <span>Leaflet with geofences and active worker markers around Sawantwadi</span>
      </div>
      <MapContainer key={`${mapCenter[0]}-${mapCenter[1]}-${selectedGeofenceId ?? "default"}`} center={mapCenter} zoom={14} scrollWheelZoom className="map-frame">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {workers.map((worker) => (
          <CircleMarker
            key={worker.id}
            center={[worker.latitude, worker.longitude]}
            radius={10}
            pathOptions={{ color: "#f8fafc", fillColor: "#22d3ee", fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>{worker.name}</strong>
              <div>Status: {worker.status}</div>
              <div>
                Coordinates: {worker.latitude.toFixed(4)}, {worker.longitude.toFixed(4)}
              </div>
              <div>Last seen: {new Date(worker.lastSeenAt).toLocaleTimeString()}</div>
            </Popup>
          </CircleMarker>
        ))}
        {geofences.map((geofence) => (
          <Circle
            key={geofence.id}
            center={geofence.center}
            radius={geofence.radiusMeters}
            pathOptions={{
              color: geofence.id === selectedGeofenceId ? "#f59e0b" : "#0f766e",
              fillColor: geofence.id === selectedGeofenceId ? "#facc15" : "#14b8a6",
              fillOpacity: geofence.id === selectedGeofenceId ? 0.25 : 0.15
            }}
          >
            <Popup>
              <strong>{geofence.name}</strong>
              <div>
                Tasks: {tasks?.filter((task) => task.geofenceId === geofence.id).length ?? 0}
              </div>
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </section>
  );
}
