# CivicTrack Architecture

## 1. High-Level System Architecture

```text
React Web Dashboard ----\
                         \
React Native Worker App ---> Express.js REST API + Socket.io ---> Auth + RBAC
                         /                                         Attendance + Geofence Validation
Supervisor Web Portal --/                                          Tasking + Proof Verification
                                                                   Dashboard Aggregations
                                                                   Audit Logging
                                                                   Reporting

Express.js + Socket.io ---> PostgreSQL + PostGIS
                         ---> Object Storage for photo proofs
                         ---> PDF/CSV Report Worker
                         ---> Mock Aadhaar eKYC provider
```

## 2. Request Flow

1. Worker signs in through mock Aadhaar eKYC and receives a JWT.
2. Mobile app captures GPS coordinates and sends attendance or periodic tracking data.
3. Backend validates freshness, drift, and geofence compliance.
4. Supervisor dashboard subscribes to live worker movement over Socket.io.
5. Reporting and analytics consume attendance, task, proof, and ping records.

## 3. Architecture Principles

- MVP first: ship attendance, tasking, tracking, dashboard visibility, and auditability.
- Production-ready seams: keep auth, reporting, and anomaly detection modular.
- Geo-first data model: geofences, proofs, and pings are location-aware from day one.
- Government-safe posture: least privilege, audit logs, encryption, and retention controls.

## 4. Folder Structure

```text
civictrack/
|- backend/
|  |- src/
|  |  |- config/
|  |  |- db/
|  |  |  \- migrations/
|  |  |- lib/
|  |  |- middleware/
|  |  |- modules/
|  |  |  |- attendance/
|  |  |  |- audit/
|  |  |  |- auth/
|  |  |  |- dashboard/
|  |  |  |- demo/
|  |  |  |- tasks/
|  |  |  \- tracking/
|  |  \- routes/
|- frontend/
|  |- src/
|  |  |- components/
|  |  \- lib/
|- mobile/
|- shared/
\- docs/
```

## 5. Backend Modules

- `auth`: JWT issuance, mocked Aadhaar eKYC integration, role enforcement.
- `attendance`: check-in/out validation, timestamp freshness checks, drift detection, geofence verification.
- `tasks`: assignment, status flow, geo-tagged proof submission.
- `tracking`: websocket ingestion of periodic GPS pings and live dashboard fan-out.
- `dashboard`: KPI aggregation, map-ready data, reporting/export orchestration.
- `audit`: immutable event trail for sign-ins, attendance events, and data changes.

## 6. Database Design and PostGIS Usage

Core tables:

- `users`
- `wards`
- `geofences`
- `attendance_logs`
- `tasks`
- `task_proofs`
- `location_pings`
- `audit_logs`

Recommended production PostGIS patterns:

- Use `ST_Distance` for radius-based geofence distance calculation.
- Use `ST_DWithin` for fast in/out checks around depots or offices.
- Use `ST_Within` against polygon geometries for ward zones and task polygons.
- Materialize `center_geog`, `polygon_geom`, and `location_geog` spatial columns for indexed search.
- Add GiST indexes on geography and geometry columns used by dashboard and compliance queries.

Example queries:

```sql
SELECT ST_Distance(
  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
  ST_SetSRID(ST_MakePoint(g.center_lng, g.center_lat), 4326)::geography
) AS distance_meters
FROM geofences g;
```

```sql
SELECT g.id, g.name
FROM geofences g
WHERE ST_Within(
  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
  g.polygon_geom
);
```

```sql
SELECT worker.id, worker.full_name, ping.captured_at
FROM users worker
JOIN location_pings ping ON ping.user_id = worker.id
WHERE ST_DWithin(
  ping.location_geog,
  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
  100
);
```

## 7. API Design

Authentication:

- `POST /api/auth/ekyc/login`
- `POST /api/mock-ekyc/verify`

Attendance:

- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/attendance/history`

Tasks:

- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/:taskId/proofs`

Dashboard and reporting:

- `GET /api/dashboard/overview`
- `GET /api/dashboard/reports/attendance`

Realtime socket events:

- Client emits `tracking:ping`
- Server broadcasts `tracking:update`
- Server emits `tracking:config`

## 8. Security and Compliance

- JWT authentication with strict RBAC by route and service layer.
- Encrypt data in transit with TLS; encrypt photo proof storage and backups at rest.
- Minimize Aadhaar exposure by storing only a reference token, never raw identity payloads after verification.
- Maintain audit logs for login, attendance, task mutation, and supervisor/admin actions.
- Follow IT Act 2000-aligned controls: consent, limited retention, access logging, breach response runbook, and data minimization.

## 9. Deployment Strategy

MVP:

- Use Supabase PostgreSQL/PostGIS as the managed database.
- Run the Express backend as a normal Node.js service with `.env` configuration.
- Run the frontend with Vite locally and deploy it later to static hosting.

Production evolution:

- Put backend behind Nginx or an API gateway.
- Move photo uploads to S3-compatible object storage.
- Add Redis for websocket scale-out and rate limiting.
- Split reporting and anomaly detection into async workers.

## 10. Scalability Considerations

- Partition `location_pings` and `attendance_logs` by date for large worker fleets.
- Add PostGIS GiST indexes once geometries are materialized.
- Use append-only audit logs and async export generation.
- Throttle mobile tracking intervals dynamically based on movement and battery state.
- Cache supervisor dashboard aggregates for ward and date filters.

## 11. MVP vs Enhancements

MVP:

- mock eKYC
- JWT auth
- GPS attendance
- task assignment
- proof metadata upload
- live worker map
- admin analytics overview

Enhancements:

- offline sync
- face verification
- anomaly detection
- object storage uploads
- async report generation

## 12. Team Collaboration Structure

- Backend team: auth, geospatial validation, reporting APIs, socket ingestion.
- Frontend team: admin dashboard, Leaflet visualization, analytics UX.
- Mobile team: worker app, offline sync, background tracking.
- DevOps/data team: Supabase bootstrap, observability, backups, retention, and secrets management.
