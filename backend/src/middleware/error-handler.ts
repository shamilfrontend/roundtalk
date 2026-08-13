import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../utils/http-error.js";

export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({
    code: "internal",
    message: "Внутренняя ошибка сервера",
  });
};
