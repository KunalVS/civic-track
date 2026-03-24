# CivicTrack API Design

## Authentication

### `POST /api/auth/ekyc/login`

Mock Aadhaar eKYC login for hackathon delivery.

Request:

```json
{
  "aadhaarNumber": "999999999999",
  "otp": "123456"
}
```

Response:

```json
{
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "fullName": "Demo Worker",
    "phone": "9876543210",
    "role": "worker",
    "wardId": "11111111-1111-1111-1111-111111111111"
  },
  "accessToken": "<jwt>",
  "ekycStatus": "verified"
}
```

## Attendance

### `POST /api/attendance/check-in`

Validates:

- geofence distance
- timestamp freshness
- drift against previous point

Request:

```json
{
  "latitude": 28.614,
  "longitude": 77.2091,
  "capturedAt": "2026-03-24T15:10:00.000Z",
  "accuracyMeters": 12,
  "geofence": {
    "type": "radius",
    "centerLat": 28.6142,
    "centerLng": 77.2089,
    "radiusMeters": 250
  },
  "previousPoint": {
    "latitude": 28.6138,
    "longitude": 77.209,
    "capturedAt": "2026-03-24T15:05:00.000Z"
  }
}
```

### `POST /api/attendance/check-out`

Worker closes the attendance session with final GPS capture.

### `GET /api/attendance/history`

Returns worker attendance history.

## Tasks

### `GET /api/tasks`

Supported query params:

- `status`
- `assignedTo`

### `POST /api/tasks`

Allowed roles:

- `supervisor`
- `admin`

Creates a ward-level task assignment with due date and target geofence.

### `POST /api/tasks/:taskId/proofs`

Uploads geo-tagged work proof metadata.

Request:

```json
{
  "imageUrl": "https://storage.example.com/proofs/proof-1.jpg",
  "latitude": 28.6118,
  "longitude": 77.2143,
  "capturedAt": "2026-03-24T15:25:00.000Z",
  "metadata": {
    "deviceId": "rn-worker-device-01",
    "networkType": "4g"
  }
}
```

## Dashboard

### `GET /api/dashboard/overview`

Allowed roles:

- `supervisor`
- `admin`

Supported query params:

- `wardId`
- `workerId`

Returns:

- KPI cards
- live worker map payload
- geofence overlays
- attendance trend data
- productivity summary
- activity heatmap points

### `GET /api/dashboard/reports/attendance?format=pdf`

Returns generated export metadata for attendance reports.

## Tracking

### `GET /api/tracking/live`

Supervisor and admin access to the most recent live worker positions.

## Socket Events

### Client emits `tracking:ping`

```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "accuracyMeters": 11,
  "batteryLevel": 54,
  "capturedAt": "2026-03-24T15:18:00.000Z"
}
```

### Server broadcasts `tracking:update`

Same payload plus `serverReceivedAt`.

### Server emits `tracking:config`

Provides backend-owned collection interval:

```json
{
  "recommendedIntervalSeconds": 120
}
```
