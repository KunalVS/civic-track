CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('worker', 'supervisor', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_type') THEN
    CREATE TYPE attendance_type AS ENUM ('check_in', 'check_out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('assigned', 'in_progress', 'completed', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE activity_type AS ENUM ('login', 'attendance', 'task_update', 'location_ping', 'data_change');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_purpose') THEN
    CREATE TYPE otp_purpose AS ENUM ('login');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  boundary_geojson JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aadhaar_ref VARCHAR(64) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role role NOT NULL,
  ward_id UUID REFERENCES wards(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code VARCHAR(32) NOT NULL UNIQUE,
  department VARCHAR(120) NOT NULL DEFAULT 'Municipal Operations',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supervisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code VARCHAR(32) NOT NULL UNIQUE,
  zone_name VARCHAR(120) NOT NULL DEFAULT 'Default Zone',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  singleton_key INTEGER NOT NULL DEFAULT 1 UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose otp_purpose NOT NULL DEFAULT 'login',
  phone VARCHAR(20) NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role role NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  ward_id UUID REFERENCES wards(id),
  type VARCHAR(16) NOT NULL DEFAULT 'radius',
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters NUMERIC(10,2),
  polygon_geojson JSONB,
  center_geog GEOGRAPHY(POINT, 4326),
  polygon_geom GEOMETRY(POLYGON, 4326),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  geofence_id UUID REFERENCES geofences(id),
  type attendance_type NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geog GEOGRAPHY(POINT, 4326),
  accuracy_meters NUMERIC(8,2),
  within_geofence BOOLEAN NOT NULL,
  drift_score NUMERIC(8,2) DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL,
  device_id VARCHAR(128),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(160) NOT NULL,
  description TEXT,
  ward_id UUID REFERENCES wards(id),
  geofence_id UUID REFERENCES geofences(id),
  assigned_to UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  status task_status NOT NULL DEFAULT 'assigned',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expected_photo_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geog GEOGRAPHY(POINT, 4326),
  captured_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS location_pings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  task_id UUID REFERENCES tasks(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_geog GEOGRAPHY(POINT, 4326),
  speed_kmph NUMERIC(8,2),
  heading NUMERIC(6,2),
  battery_level NUMERIC(5,2),
  accuracy_meters NUMERIC(8,2),
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES users(id),
  target_table VARCHAR(64) NOT NULL,
  target_id VARCHAR(64),
  activity_type activity_type NOT NULL,
  action VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_user_created ON otp_codes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_created ON auth_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_user_captured ON attendance_logs (user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_pings_user_captured ON location_pings (user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_assigned_to ON tasks (status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_geofences_center_geog ON geofences USING GIST (center_geog);
CREATE INDEX IF NOT EXISTS idx_geofences_polygon_geom ON geofences USING GIST (polygon_geom);
CREATE INDEX IF NOT EXISTS idx_attendance_location_geog ON attendance_logs USING GIST (location_geog);
CREATE INDEX IF NOT EXISTS idx_task_proofs_location_geog ON task_proofs USING GIST (location_geog);
CREATE INDEX IF NOT EXISTS idx_location_pings_location_geog ON location_pings USING GIST (location_geog);

CREATE OR REPLACE FUNCTION sync_geofence_geometries()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.center_lat IS NOT NULL AND NEW.center_lng IS NOT NULL THEN
    NEW.center_geog := ST_SetSRID(ST_MakePoint(NEW.center_lng, NEW.center_lat), 4326)::geography;
  END IF;

  IF NEW.polygon_geojson IS NOT NULL THEN
    NEW.polygon_geom := ST_SetSRID(ST_GeomFromGeoJSON(NEW.polygon_geojson::text), 4326);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_point_geographies()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location_geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_geofences_sync ON geofences;
CREATE TRIGGER trg_geofences_sync
BEFORE INSERT OR UPDATE ON geofences
FOR EACH ROW
EXECUTE FUNCTION sync_geofence_geometries();

DROP TRIGGER IF EXISTS trg_attendance_sync ON attendance_logs;
CREATE TRIGGER trg_attendance_sync
BEFORE INSERT OR UPDATE ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION sync_point_geographies();

DROP TRIGGER IF EXISTS trg_task_proofs_sync ON task_proofs;
CREATE TRIGGER trg_task_proofs_sync
BEFORE INSERT OR UPDATE ON task_proofs
FOR EACH ROW
EXECUTE FUNCTION sync_point_geographies();

DROP TRIGGER IF EXISTS trg_location_pings_sync ON location_pings;
CREATE TRIGGER trg_location_pings_sync
BEFORE INSERT OR UPDATE ON location_pings
FOR EACH ROW
EXECUTE FUNCTION sync_point_geographies();

INSERT INTO wards (id, name, code, boundary_geojson)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Ward 12',
  'WARD-12',
  '{"type":"Polygon","coordinates":[[[77.204,28.609],[77.219,28.609],[77.219,28.619],[77.204,28.619],[77.204,28.609]]]}'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, aadhaar_ref, full_name, phone, email, password_hash, role, ward_id, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'aadhaar-demo-worker', 'Demo Worker', '9876543210', 'worker@civictrack.local', '758707e2420bbdee6300dc8e2f4ff0cd:df8a789c17e550721484ef8dc3c58e9578ba2c0e761791e3b7e47a0fbe977d58412efd228d986855adbca22b362cff422ab3fd33f72fbab9cd6eadd3bc1ec946', 'worker', '11111111-1111-1111-1111-111111111111', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'aadhaar-demo-supervisor', 'Demo Supervisor', '9876543211', 'supervisor@civictrack.local', '758707e2420bbdee6300dc8e2f4ff0cd:df8a789c17e550721484ef8dc3c58e9578ba2c0e761791e3b7e47a0fbe977d58412efd228d986855adbca22b362cff422ab3fd33f72fbab9cd6eadd3bc1ec946', 'supervisor', '11111111-1111-1111-1111-111111111111', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'aadhaar-demo-admin', 'Demo Admin', '9876543212', 'admin@civictrack.local', '758707e2420bbdee6300dc8e2f4ff0cd:df8a789c17e550721484ef8dc3c58e9578ba2c0e761791e3b7e47a0fbe977d58412efd228d986855adbca22b362cff422ab3fd33f72fbab9cd6eadd3bc1ec946', 'admin', NULL, TRUE),
  ('00000000-0000-0000-0000-000000000004', 'aadhaar-line-crew-14', 'Line Crew 14', '9876543213', 'crew14@civictrack.local', '758707e2420bbdee6300dc8e2f4ff0cd:df8a789c17e550721484ef8dc3c58e9578ba2c0e761791e3b7e47a0fbe977d58412efd228d986855adbca22b362cff422ab3fd33f72fbab9cd6eadd3bc1ec946', 'worker', '11111111-1111-1111-1111-111111111111', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workers (id, user_id, employee_code, department)
VALUES
  ('44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'WRK-0001', 'Sanitation'),
  ('44444444-4444-4444-4444-444444444442', '00000000-0000-0000-0000-000000000004', 'WRK-0014', 'Electrical')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO supervisors (id, user_id, employee_code, zone_name)
VALUES
  ('55555555-5555-5555-5555-555555555551', '00000000-0000-0000-0000-000000000002', 'SUP-0001', 'Ward 12 Central')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO admins (id, user_id, singleton_key)
VALUES
  ('66666666-6666-6666-6666-666666666661', '00000000-0000-0000-0000-000000000003', 1)
ON CONFLICT (singleton_key) DO NOTHING;

INSERT INTO geofences (id, name, ward_id, type, center_lat, center_lng, radius_meters, created_by)
VALUES
  ('22222222-2222-2222-2222-222222222221', 'Ward 12 Depot', '11111111-1111-1111-1111-111111111111', 'radius', 28.6142, 77.2089, 250, '00000000-0000-0000-0000-000000000002'),
  ('22222222-2222-2222-2222-222222222222', 'Drainage Inspection Corridor', '11111111-1111-1111-1111-111111111111', 'radius', 28.6116, 77.2145, 420, '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, title, description, ward_id, geofence_id, assigned_to, assigned_by, status, priority, due_at, expected_photo_count)
VALUES
  ('33333333-3333-3333-3333-333333333331', 'Drainage inspection', 'Inspect blocked drains in the central corridor and upload geo-tagged proof.', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'in_progress', 'high', NOW() + INTERVAL '2 hours', 2),
  ('33333333-3333-3333-3333-333333333332', 'Streetlight audit', 'Audit streetlights near the depot and mark faulty poles.', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'assigned', 'medium', NOW() + INTERVAL '4 hours', 1)
ON CONFLICT (id) DO NOTHING;
