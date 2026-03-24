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

export function MapPanel({
  workers,
  geofences
}: {
  workers: WorkerLocation[];
  geofences: GeofenceItem[];
}) {
  return (
    <section className="panel map-panel">
      <div className="panel-header">
        <h2>Live Workforce Map</h2>
        <span>Leaflet with geofences and worker markers</span>
      </div>
      <MapContainer center={[28.6139, 77.209]} zoom={13} scrollWheelZoom className="map-frame">
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
              <div>{worker.status}</div>
              <div>Last seen: {new Date(worker.lastSeenAt).toLocaleTimeString()}</div>
            </Popup>
          </CircleMarker>
        ))}
        {geofences.map((geofence) => (
          <Circle
            key={geofence.id}
            center={geofence.center}
            radius={geofence.radiusMeters}
            pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.15 }}
          />
        ))}
      </MapContainer>
    </section>
  );
}
