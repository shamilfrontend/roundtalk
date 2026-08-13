import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";
import { accessCookieMaxAgeMs, refreshCookieMaxAgeMs } from "./jwt.js";

export const ACCESS_COOKIE = "accessToken";
export const REFRESH_COOKIE = "refreshToken";
export const OAUTH_STATE_COOKIE = "oauth_state";
export const OAUTH_VERIFIER_COOKIE = "oauth_code_verifier";

const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.clientUrl.startsWith("https://"),
    path: "/",
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  const base = baseCookieOptions();

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    maxAge: accessCookieMaxAgeMs(),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: refreshCookieMaxAgeMs(),
  });
}

export function clearAuthCookies(res: Response): void {
  const base = baseCookieOptions();

  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

export function setOauthCookies(
  res: Response,
  state: string,
  codeVerifier?: string,
): void {
  const base = baseCookieOptions();

  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...base,
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
  });

  if (codeVerifier !== undefined) {
    res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, {
      ...base,
      maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    });
  }
}

export function clearOauthCookies(res: Response): void {
  const base = baseCookieOptions();

  res.clearCookie(OAUTH_STATE_COOKIE, base);
  res.clearCookie(OAUTH_VERIFIER_COOKIE, base);
}

export function readCookie(req: Request, name: string): string | undefined {
  const value = req.cookies?.[name];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseCookieHeader(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) {
    return undefined;
  }

  const parts = header.split(";");

  for (const part of parts) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = part.slice(0, separator).trim();

    if (key !== name) {
      continue;
    }

    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return undefined;
}
