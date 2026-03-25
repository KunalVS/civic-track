import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().optional());

const optionalUrl = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().url().optional());

const currentFile = fileURLToPath(import.meta.url);
const backendDir = path.resolve(path.dirname(currentFile), "..", "..");
const repoRoot = path.resolve(backendDir, "..");

const candidateEnvFiles = [
  path.join(backendDir, ".env"),
  path.join(repoRoot, ".env"),
  path.join(backendDir, ".env.example"),
  path.join(repoRoot, ".env.example")
];

for (const envFile of candidateEnvFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("12h"),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  OTP_TTL_MINUTES: z.coerce.number().default(5),
  ALLOWED_ORIGIN: z.string().default("http://localhost:5173"),
  SOCKET_PING_INTERVAL_MS: z.coerce.number().default(30000),
  ATTENDANCE_MAX_DRIFT_METERS: z.coerce.number().default(250),
  TRACKING_MIN_INTERVAL_SECONDS: z.coerce.number().default(120),
  ANOMALY_DETECTION_URL: z.string().url().default("http://127.0.0.1:5001/detect"),
  MOCK_AADHAAR_BASE_URL: z.string().min(1),
  SMS_PROVIDER_URL: optionalUrl,
  SMS_PROVIDER_API_KEY: optionalString,
  SMS_SENDER_ID: optionalString,
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    [
      "Invalid CivicTrack environment configuration.",
      `Looked for env files in: ${candidateEnvFiles.join(", ")}`,
      `Missing or invalid keys: ${parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    ].join(" ")
  );
}

export const env = parsedEnv.data;
