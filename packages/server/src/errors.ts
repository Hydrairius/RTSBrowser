import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ServerMessage } from "@rtsbrowser/shared";
import type { WebSocket } from "ws";

/** Machine-readable codes returned in HTTP JSON and WebSocket error messages. */
export const ErrorCode = {
  VALIDATION: "VALIDATION",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  ROOM_FULL: "ROOM_FULL",
  NOT_IN_ROOM: "NOT_IN_ROOM",
  INVALID_JSON: "INVALID_JSON",
  UNKNOWN_MESSAGE: "UNKNOWN_MESSAGE",
  INVALID_COMMAND: "INVALID_COMMAND",
  INTERNAL: "INTERNAL",
  DATABASE: "DATABASE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, message: string, code: ErrorCode = ErrorCode.VALIDATION) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function logServerError(context: string, err: unknown): void {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[server:${context}]`, detail);
}

/** Wrap async Express handlers so thrown HttpErrors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found.", code: ErrorCode.NOT_FOUND });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  logServerError("http", err);
  res.status(500).json({
    error: "Internal server error.",
    code: ErrorCode.INTERNAL,
  });
}

export function sendWsError(
  ws: WebSocket,
  message: string,
  code: ErrorCode | string = ErrorCode.VALIDATION,
): void {
  const payload: ServerMessage = { type: "error", message, code };
  safeWsSend(ws, payload);
}

export function safeWsSend(ws: WebSocket, msg: ServerMessage): boolean {
  if (ws.readyState !== ws.OPEN) return false;
  try {
    ws.send(JSON.stringify(msg));
    return true;
  } catch (err) {
    logServerError("ws-send", err);
    return false;
  }
}

export function assertProductionSecrets(jwtSecret: string): void {
  if (process.env.NODE_ENV !== "production") return;
  if (jwtSecret === "dev-secret-change-me" || jwtSecret.length < 32) {
    console.error(
      "FATAL: Set a strong JWT_SECRET (32+ chars) in production. Refusing to start.",
    );
    process.exit(1);
  }
}
