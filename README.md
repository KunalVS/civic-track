# CivicTrack

CivicTrack is a GPS-based attendance and municipal workforce tracking platform designed for government field operations. This repository is structured as an MVP-first monorepo with room for production hardening.

## What This Repository Delivers

- High-level architecture for a GPS attendance and workforce tracking platform
- Backend MVP scaffold with Express, Socket.io, Drizzle-ready schema, and PostGIS migration
- React dashboard scaffold with Leaflet-based live map
- Delivery notes for the React Native worker app
- Supabase PostgreSQL setup for persistent auth and operations data

## Monorepo Layout

- `backend`: Express.js API, Socket.io realtime server, Drizzle ORM schema, PostGIS-aware services.
- `frontend`: React + Leaflet admin dashboard scaffold.
- `shared`: Cross-app role and API contract types.
- `mobile`: React Native implementation notes and delivery plan.
- `docs`: Architecture, API, scalability, and delivery guidance.

## Quick Start

1. Copy `.env.example` to `.env` and set your Supabase Postgres connection string.
2. Run the SQL bootstrap in Supabase:

```sql
-- run backend/src/db/migrations/0000_init.sql in the Supabase SQL editor
```

3. Install dependencies and start the apps:

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

## Folder Structure

```text
civictrack/
|- backend/
|  |- src/
|  |  |- config/
|  |  |- db/
|  |  |- middleware/
|  |  |- modules/
|  |  \- routes/
|- frontend/
|  \- src/
|     |- components/
|     \- lib/
|- shared/
|  \- src/
|- mobile/
\- docs/
```

## Key Deliverables

- Architecture: [docs/architecture.md](C:/Users/ASUS/OneDrive/Desktop/civictrack/docs/architecture.md)
- API design: [docs/api-design.md](C:/Users/ASUS/OneDrive/Desktop/civictrack/docs/api-design.md)
- MVP plan: [docs/mvp-delivery-plan.md](C:/Users/ASUS/OneDrive/Desktop/civictrack/docs/mvp-delivery-plan.md)
- Supabase setup: [docs/supabase-setup.md](C:/Users/ASUS/OneDrive/Desktop/civictrack/docs/supabase-setup.md)
