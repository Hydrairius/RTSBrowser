import type { ClientMessage, CommandOp } from "@rtsbrowser/shared";
import { ErrorCode } from "./errors.js";

const MAX_DISPLAY_NAME = 32;
const MAX_ROOM_ID = 64;
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_MOVE_DELTA = 10;

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; message: string; code: ErrorCode };

export type AuthBodyResult =
  | { ok: true; email: string; password: string }
  | { ok: false; message: string; code: ErrorCode };

export function validateAuthBody(body: unknown): AuthBodyResult {
  if (!body || typeof body !== "object") {
    return fail("Request body must be JSON.", ErrorCode.VALIDATION);
  }
  const { email, password } = body as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    return fail("Email and password must be strings.", ErrorCode.VALIDATION);
  }
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) {
    return fail("A valid email is required.", ErrorCode.VALIDATION);
  }
  if (password.length < 8) {
    return fail("Password must be at least 8 characters.", ErrorCode.VALIDATION);
  }
  if (password.length > 128) {
    return fail("Password is too long.", ErrorCode.VALIDATION);
  }
  return { ok: true, email: trimmed, password };
}

export function parseClientMessage(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail("Invalid JSON.", ErrorCode.INVALID_JSON);
  }

  if (!data || typeof data !== "object" || !("type" in data)) {
    return fail("Message must be an object with a type field.", ErrorCode.UNKNOWN_MESSAGE);
  }

  const msg = data as Record<string, unknown>;
  const type = msg.type;

  switch (type) {
    case "ping":
      return { ok: true, message: { type: "ping" } };

    case "create_room": {
      const displayName = normalizeDisplayName(msg.displayName);
      if (!displayName.ok) return displayName;
      return { ok: true, message: { type: "create_room", displayName: displayName.value } };
    }

    case "join_room": {
      const roomId = normalizeRoomId(msg.roomId);
      if (!roomId.ok) return roomId;
      const displayName = normalizeDisplayName(msg.displayName);
      if (!displayName.ok) return displayName;
      return {
        ok: true,
        message: { type: "join_room", roomId: roomId.value, displayName: displayName.value },
      };
    }

    case "submit_command": {
      const op = msg.op;
      if (op !== "noop" && op !== "move") {
        return fail(`Unknown command op: ${String(op)}`, ErrorCode.INVALID_COMMAND);
      }
      const parsed: ClientMessage = { type: "submit_command", op: op as CommandOp };
      if (op === "move") {
        const dx = parseMoveDelta(msg.dx, "dx");
        if (!dx.ok) return dx;
        const dy = parseMoveDelta(msg.dy, "dy");
        if (!dy.ok) return dy;
        parsed.dx = dx.value;
        parsed.dy = dy.value;
      }
      return { ok: true, message: parsed };
    }

    default:
      return fail(`Unknown message type: ${String(type)}`, ErrorCode.UNKNOWN_MESSAGE);
  }
}

function normalizeDisplayName(
  value: unknown,
): { ok: true; value: string } | { ok: false; message: string; code: ErrorCode } {
  const name =
    typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_DISPLAY_NAME) : "Commander";
  if (name.length === 0) {
    return fail("Display name cannot be empty.", ErrorCode.VALIDATION);
  }
  return { ok: true, value: name };
}

function normalizeRoomId(
  value: unknown,
): { ok: true; value: string } | { ok: false; message: string; code: ErrorCode } {
  if (typeof value !== "string") {
    return fail("Room ID is required.", ErrorCode.VALIDATION);
  }
  const id = value.trim();
  if (!id || id.length > MAX_ROOM_ID || !ROOM_ID_PATTERN.test(id)) {
    return fail("Room ID must be 1–64 alphanumeric characters, dashes, or underscores.", ErrorCode.VALIDATION);
  }
  return { ok: true, value: id };
}

function parseMoveDelta(
  value: unknown,
  field: string,
): { ok: true; value: number } | { ok: false; message: string; code: ErrorCode } {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return fail(`${field} must be an integer.`, ErrorCode.INVALID_COMMAND);
  }
  if (Math.abs(value) > MAX_MOVE_DELTA) {
    return fail(`${field} must be between -${MAX_MOVE_DELTA} and ${MAX_MOVE_DELTA}.`, ErrorCode.INVALID_COMMAND);
  }
  return { ok: true, value };
}

type ValidationFail = { ok: false; message: string; code: ErrorCode };

function fail(message: string, code: ErrorCode): ValidationFail {
  return { ok: false, message, code };
}
