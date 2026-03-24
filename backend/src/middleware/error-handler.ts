import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: err.issues[0]?.message ?? "Invalid request payload"
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      message: err.message
    });
  }

  res.status(500).json({
    message: "Internal server error"
  });
}
