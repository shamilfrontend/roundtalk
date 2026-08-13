import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";
import { parseDurationMs } from "./duration.js";
import { isRecord } from "./json.js";

export type JwtTokenType = "access" | "refresh";

export interface JwtPayload {
  sub: string;
  type: JwtTokenType;
}

const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

function accessTtlSec(): number {
  return Math.floor(parseDurationMs(env.jwtExpiresIn) / 1000);
}

function signToken(payload: JwtPayload, expiresInSec: number): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: expiresInSec });
}

export function signAccessToken(userId: string): string {
  return signToken({ sub: userId, type: "access" }, accessTtlSec());
}

export function signRefreshToken(userId: string): string {
  return signToken({ sub: userId, type: "refresh" }, REFRESH_TTL_SEC);
}

export function accessCookieMaxAgeMs(): number {
  return parseDurationMs(env.jwtExpiresIn);
}

export function refreshCookieMaxAgeMs(): number {
  return REFRESH_TTL_SEC * 1000;
}

function parsePayload(value: unknown): JwtPayload {
  if (!isRecord(value)) {
    throw new HttpError(401, "unauthorized", "Недействительный токен");
  }

  const sub = value.sub;
  const type = value.type;

  if (typeof sub !== "string" || sub.length === 0) {
    throw new HttpError(401, "unauthorized", "Недействительный токен");
  }

  if (type !== "access" && type !== "refresh") {
    throw new HttpError(401, "unauthorized", "Недействительный токен");
  }

  return { sub, type };
}

export function verifyToken(token: string, type: JwtTokenType): JwtPayload {
  try {
    const decoded: unknown = jwt.verify(token, env.jwtSecret);
    const payload = parsePayload(decoded);

    if (payload.type !== type) {
      throw new HttpError(401, "unauthorized", "Недействительный токен");
    }

    return payload;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "unauthorized", "Недействительный токен");
  }
}
