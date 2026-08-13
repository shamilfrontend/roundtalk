import { Router, type Response } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { getAuthUser, requireAuth } from "../middleware/require-auth.js";
import {
  buildYandexAuthorizeUrl,
  fetchYandexProfile,
} from "../services/oauth-yandex.js";
import {
  buildVkAuthorizeUrl,
  createVkPkce,
  fetchVkProfile,
} from "../services/oauth-vk.js";
import { findOrCreateOAuthUser, findUserById } from "../services/users.js";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  clearOauthCookies,
  readCookie,
  setAuthCookies,
  setOauthCookies,
} from "../utils/cookies.js";
import { safeEqual } from "../utils/crypto-equal.js";
import { HttpError } from "../utils/http-error.js";
import { randomUrlToken } from "../utils/ids.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";
import { asString } from "../utils/validate.js";

export const authRouter = Router();

function loginRedirect(errorCode?: string): string {
  if (errorCode === undefined) {
    return env.clientUrl;
  }

  return `${env.clientUrl}/login?error=${errorCode}`;
}

function readQueryString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return asString(value[0]);
  }

  return asString(value);
}

function requireOauthState(
  reqState: string | undefined,
  cookieState: string | undefined,
): string {
  if (
    reqState === undefined ||
    cookieState === undefined ||
    !safeEqual(reqState, cookieState)
  ) {
    throw new HttpError(403, "invalid_state", "Несовпадение state");
  }

  return reqState;
}

function issueSession(res: Response, userId: string): void {
  setAuthCookies(res, signAccessToken(userId), signRefreshToken(userId));
}

authRouter.get(
  "/yandex",
  asyncHandler(async (_req, res) => {
    const state = randomUrlToken();

    setOauthCookies(res, state);
    res.redirect(buildYandexAuthorizeUrl(state));
  }),
);

authRouter.get(
  "/yandex/callback",
  asyncHandler(async (req, res) => {
    const cookieState = readCookie(req, OAUTH_STATE_COOKIE);

    clearOauthCookies(res);

    const providerError = readQueryString(req.query.error);

    if (providerError !== undefined) {
      res.redirect(loginRedirect("oauth_denied"));
      return;
    }

    try {
      requireOauthState(readQueryString(req.query.state), cookieState);

      const code = readQueryString(req.query.code);

      if (code === undefined) {
        throw new HttpError(400, "invalid_code", "Нет кода авторизации");
      }

      const profile = await fetchYandexProfile(code);
      const user = await findOrCreateOAuthUser({
        email: profile.email,
        name: profile.name,
        yandexId: profile.yandexId,
      });

      issueSession(res, user.id);
      res.redirect(loginRedirect());
    } catch (error) {
      if (error instanceof HttpError && error.status === 403) {
        throw error;
      }

      if (error instanceof HttpError && error.code === "email_required") {
        res.redirect(loginRedirect("email_required"));
        return;
      }

      console.error("OAuth Yandex callback failed");
      res.redirect(loginRedirect("oauth_failed"));
    }
  }),
);

authRouter.get(
  "/vk",
  asyncHandler(async (_req, res) => {
    const state = randomUrlToken();
    const pkce = createVkPkce();

    setOauthCookies(res, state, pkce.verifier);
    res.redirect(buildVkAuthorizeUrl(state, pkce.challenge));
  }),
);

authRouter.get(
  "/vk/callback",
  asyncHandler(async (req, res) => {
    const cookieState = readCookie(req, OAUTH_STATE_COOKIE);
    const verifier = readCookie(req, OAUTH_VERIFIER_COOKIE);

    clearOauthCookies(res);

    const providerError = readQueryString(req.query.error);

    if (providerError !== undefined) {
      res.redirect(loginRedirect("oauth_denied"));
      return;
    }

    try {
      const state = requireOauthState(
        readQueryString(req.query.state),
        cookieState,
      );
      const code = readQueryString(req.query.code);
      const deviceId = readQueryString(req.query.device_id);

      if (code === undefined || verifier === undefined || deviceId === undefined) {
        throw new HttpError(403, "invalid_state", "Несовпадение state");
      }

      const profile = await fetchVkProfile({
        code,
        codeVerifier: verifier,
        deviceId,
        state,
      });
      const user = await findOrCreateOAuthUser({
        email: profile.email,
        name: profile.name,
        vkId: profile.vkId,
      });

      issueSession(res, user.id);
      res.redirect(loginRedirect());
    } catch (error) {
      if (error instanceof HttpError && error.status === 403) {
        throw error;
      }

      if (error instanceof HttpError && error.code === "email_required") {
        res.redirect(loginRedirect("email_required"));
        return;
      }

      console.error("OAuth VK callback failed");
      res.redirect(loginRedirect("oauth_failed"));
    }
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(getAuthUser(req));
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearAuthCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = readCookie(req, REFRESH_COOKIE);

    if (!refreshToken) {
      throw new HttpError(401, "unauthorized", "Нужна авторизация");
    }

    const payload = verifyToken(refreshToken, "refresh");
    const user = await findUserById(payload.sub);

    if (!user) {
      throw new HttpError(401, "unauthorized", "Нужна авторизация");
    }

    issueSession(res, user.id);
    res.json(user);
  }),
);
