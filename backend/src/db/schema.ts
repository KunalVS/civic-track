import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["worker", "supervisor", "admin"]);
export const attendanceTypeEnum = pgEnum("attendance_type", ["check_in", "check_out"]);
export const taskStatusEnum = pgEnum("task_status", ["assigned", "in_progress", "completed", "rejected"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "critical"]);
export const activityTypeEnum = pgEnum("activity_type", [
  "login",
  "attendance",
  "task_update",
  "location_ping",
  "data_change"
]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["login"]);

export const wards = pgTable("wards", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  boundaryGeojson: jsonb("boundary_geojson"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    aadhaarRef: varchar("aadhaar_ref", { length: 64 }).notNull().unique(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    wardId: uuid("ward_id").references(() => wards.id),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    usersPhoneUnique: uniqueIndex("users_phone_unique").on(table.phone),
    usersEmailUnique: uniqueIndex("users_email_unique").on(table.email)
  })
);

export const workers = pgTable("workers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  employeeCode: varchar("employee_code", { length: 32 }).notNull().unique(),
  department: varchar("department", { length: 120 }).notNull().default("Municipal Operations"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const supervisors = pgTable("supervisors", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  employeeCode: varchar("employee_code", { length: 32 }).notNull().unique(),
  zoneName: varchar("zone_name", { length: 120 }).notNull().default("Default Zone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const admins = pgTable(
  "admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    singletonKey: integer("singleton_key").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    singletonKeyUnique: uniqueIndex("admins_singleton_key_unique").on(table.singletonKey)
  })
);

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  purpose: otpPurposeEnum("purpose").notNull().default("login"),
  phone: varchar("phone", { length: 20 }).notNull(),
  otpHash: varchar("otp_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const geofences = pgTable("geofences", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  wardId: uuid("ward_id").references(() => wards.id),
  type: varchar("type", { length: 16 }).notNull().default("radius"),
  centerLat: doublePrecision("center_lat"),
  centerLng: doublePrecision("center_lng"),
  radiusMeters: numeric("radius_meters", { precision: 10, scale: 2 }),
  polygonGeojson: jsonb("polygon_geojson"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const attendanceLogs = pgTable("attendance_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  geofenceId: uuid("geofence_id").references(() => geofences.id),
  type: attendanceTypeEnum("type").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracyMeters: numeric("accuracy_meters", { precision: 8, scale: 2 }),
  withinGeofence: boolean("within_geofence").notNull(),
  driftScore: numeric("drift_score", { precision: 8, scale: 2 }).default("0"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  deviceId: varchar("device_id", { length: 128 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  wardId: uuid("ward_id").references(() => wards.id),
  geofenceId: uuid("geofence_id").references(() => geofences.id),
  assignedTo: uuid("assigned_to").references(() => users.id),
  assignedBy: uuid("assigned_by").references(() => users.id),
  status: taskStatusEnum("status").notNull().default("assigned"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expectedPhotoCount: integer("expected_photo_count").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const taskProofs = pgTable("task_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  imageUrl: text("image_url").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const completedFieldTasks = pgTable(
  "completed_field_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: varchar("task_id", { length: 64 }).notNull(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => users.id),
    workerName: varchar("worker_name", { length: 160 }).notNull(),
    taskName: varchar("task_name", { length: 160 }).notNull(),
    beforeImageUrl: text("before_image_url").notNull(),
    afterImageUrl: text("after_image_url").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    completedFieldTasksTaskUnique: uniqueIndex("completed_field_tasks_task_id_unique").on(table.taskId)
  })
);

export const locationPings = pgTable("location_pings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  taskId: uuid("task_id").references(() => tasks.id),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  speedKmph: numeric("speed_kmph", { precision: 8, scale: 2 }),
  heading: numeric("heading", { precision: 6, scale: 2 }),
  batteryLevel: numeric("battery_level", { precision: 5, scale: 2 }),
  accuracyMeters: numeric("accuracy_meters", { precision: 8, scale: 2 }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  targetTable: varchar("target_table", { length: 64 }).notNull(),
  targetId: varchar("target_id", { length: 64 }),
  activityType: activityTypeEnum("activity_type").notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
