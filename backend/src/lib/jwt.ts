import jwt from "jsonwebtoken";
import type { AuthUser } from "@civictrack/shared";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

interface AccessTokenPayload extends AuthUser {
  sessionId: string;
}

export function signAccessToken(user: AuthUser, sessionId: string) {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign({ ...user, sessionId } satisfies AccessTokenPayload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
