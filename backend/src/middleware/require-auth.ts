import type { NextFunction, Request, RequestHandler, Response } from "express";
import { findUserById } from "../services/users.js";
import type { AuthUser } from "../types/auth.js";
import { ACCESS_COOKIE, readCookie } from "../utils/cookies.js";
import { HttpError } from "../utils/http-error.js";
import { verifyToken } from "../utils/jwt.js";

export const requireAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  void (async () => {
    const token = readCookie(req, ACCESS_COOKIE);

    if (!token) {
      throw new HttpError(401, "unauthorized", "Нужна авторизация");
    }

    const payload = verifyToken(token, "access");
    const user = await findUserById(payload.sub);

    if (!user) {
      throw new HttpError(401, "unauthorized", "Нужна авторизация");
    }

    req.authUser = user;
    next();
  })().catch(next);
};

export function getAuthUser(req: Request): AuthUser {
  if (req.authUser === undefined) {
    throw new HttpError(401, "unauthorized", "Нужна авторизация");
  }

  return req.authUser;
}
