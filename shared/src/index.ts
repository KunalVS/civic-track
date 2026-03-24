export const roles = ["worker", "supervisor", "admin"] as const;

export type Role = (typeof roles)[number];

export interface GeoPointPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: Role;
  wardId?: string | null;
}
