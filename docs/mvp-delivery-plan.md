# CivicTrack MVP Delivery Plan

## Phase 1: Hackathon MVP

- Mock Aadhaar eKYC login and JWT issuance
- Worker GPS check-in/check-out
- Supervisor task assignment
- Geo-tagged proof upload metadata
- Live worker map for supervisors and admins
- Ward-level KPI dashboard
- Audit logging hooks for sensitive actions

## Phase 2: Production Hardening

- Persist API flows in PostgreSQL through Drizzle repositories
- Move proof images to S3-compatible object storage
- Introduce Redis adapter for horizontal Socket.io scale
- Add background job workers for PDF and CSV report generation
- Add device binding, token rotation, and refresh tokens
- Add retention policies and archival for historical pings

## Suggested Team Split

### Backend

- auth, JWT, RBAC
- attendance validation service
- task lifecycle service
- dashboard aggregations
- report generation worker

### Frontend Web

- control center layout
- map overlays and filters
- reporting UX
- SLA and productivity widgets

### Mobile

- eKYC login
- GPS attendance capture
- proof upload flow
- resilient background sync

### DevOps and Data

- Supabase bootstrap
- PostGIS schema rollout and backups
- secrets and environment management
- observability and health checks

## Non-Functional Targets

- ingest 1 ping every 2 minutes for 10,000 workers
- keep dashboard live location staleness below 15 seconds for active sockets
- partition historical tracking tables monthly once the rollout grows
- isolate ward-based data access in both API and analytics layers
