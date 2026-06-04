import type { ServerMessage } from "@rtsbrowser/shared";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { WebSocketServer } from "ws";
import { authMiddleware, getAuthUser, loginUser, registerUser, verifyToken } from "./auth.js";
import { closeDatabase, openDatabase } from "./db.js";
import {
  assertProductionSecrets,
  asyncHandler,
  errorHandler,
  HttpError,
  logServerError,
  notFoundHandler,
  sendWsError,
  safeWsSend,
} from "./errors.js";
import { buildDevSnapshot, isDevDebugEnabled } from "./dev-debug.js";
import { getOrCreateRoom, getRoomDebug, shutdownAllRooms, type AddHumanResult } from "./game-room.js";
import { parseClientMessage, validateAuthBody } from "./validate.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const PORT = Number(process.env.PORT ?? 3001);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const DATABASE_PATH = process.env.DATABASE_PATH ?? path.join(repoRoot, "data", "rtsbrowser.db");
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

assertProductionSecrets(JWT_SECRET);

let db: ReturnType<typeof openDatabase>;
try {
  db = openDatabase(DATABASE_PATH);
} catch (err) {
  if (err instanceof HttpError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

if (isDevDebugEnabled()) {
  app.get("/api/dev/snapshot", (_req, res) => {
    res.json(buildDevSnapshot(db, DATABASE_PATH));
  });

  app.get("/api/dev/rooms/:roomId", (req, res) => {
    const room = getRoomDebug(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found.", code: "NOT_FOUND" });
      return;
    }
    res.json(room);
  });

  console.log("Dev debug API enabled: GET /api/dev/snapshot, GET /api/dev/rooms/:id");
}

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const body = validateAuthBody(req.body);
    if (!body.ok) {
      res.status(400).json({ error: body.message, code: body.code });
      return;
    }
    const result = registerUser(db, JWT_SECRET, body.email, body.password);
    if ("error" in result) {
      const status = result.code === "CONFLICT" ? 409 : 400;
      res.status(status).json({ error: result.error, code: result.code });
      return;
    }
    res.status(201).json(result);
  }),
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const body = validateAuthBody(req.body);
    if (!body.ok) {
      res.status(400).json({ error: body.message, code: body.code });
      return;
    }
    const result = loginUser(db, JWT_SECRET, body.email, body.password);
    if ("error" in result) {
      res.status(401).json({ error: result.error, code: result.code ?? "UNAUTHORIZED" });
      return;
    }
    res.json(result);
  }),
);

app.get(
  "/api/auth/me",
  authMiddleware(JWT_SECRET),
  asyncHandler(async (req, res) => {
    const user = getAuthUser(db, req.user!);
    if (!user) {
      throw new HttpError(404, "User not found.", "NOT_FOUND");
    }
    res.json({ user });
  }),
);

app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== "/ws/game") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = url.searchParams.get("token");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const payload = verifyToken(JWT_SECRET, token);
    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, payload);
    });
  } catch (err) {
    logServerError("ws:upgrade", err);
    try {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    } catch {
      /* ignore */
    }
    socket.destroy();
  }
});

wss.on("connection", (ws, payload: { sub: string; email: string }) => {
  let playerId: string | null = null;
  let roomId: string | null = null;

  ws.on("error", (err) => {
    logServerError(`ws:client:${playerId ?? "anonymous"}`, err);
  });

  ws.on("message", (raw) => {
    try {
      const text = typeof raw === "string" ? raw : raw.toString();
      const parsed = parseClientMessage(text);
      if (!parsed.ok) {
        sendWsError(ws, parsed.message, parsed.code);
        return;
      }
      const msg = parsed.message;

      if (msg.type === "create_room") {
        const room = getOrCreateRoom();
        const joined = joinRoomOrError(ws, room, payload.sub, msg.displayName);
        if (!joined) return;
        roomId = room.id;
        playerId = joined.playerId;
        send(ws, {
          type: "room_joined",
          roomId: room.id,
          playerId: joined.playerId,
          slots: joined.slots,
          snapshot: joined.snapshot,
        });
        return;
      }

      if (msg.type === "join_room") {
        const room = getOrCreateRoom(msg.roomId);
        const joined = joinRoomOrError(ws, room, payload.sub, msg.displayName);
        if (!joined) return;
        roomId = room.id;
        playerId = joined.playerId;
        send(ws, {
          type: "room_joined",
          roomId: room.id,
          playerId: joined.playerId,
          slots: joined.slots,
          snapshot: joined.snapshot,
        });
        return;
      }

      if (!playerId || !roomId) {
        sendWsError(ws, "Join or create a room first.", "NOT_IN_ROOM");
        return;
      }

      const room = getOrCreateRoom(roomId);
      room.handleMessage(playerId, msg);
    } catch (err) {
      logServerError(`ws:message:${playerId ?? "anonymous"}`, err);
      sendWsError(ws, "Internal server error.", "INTERNAL");
    }
  });

  ws.on("close", () => {
    if (playerId && roomId) {
      try {
        getOrCreateRoom(roomId).removeClient(playerId);
      } catch (err) {
        logServerError(`ws:close:${roomId}`, err);
      }
    }
  });
});

function joinRoomOrError(
  ws: import("ws").WebSocket,
  room: ReturnType<typeof getOrCreateRoom>,
  userId: string,
  displayName: string,
): Extract<AddHumanResult, { ok: true }> | null {
  const joined = room.addHuman(ws, userId, displayName);
  if (!joined.ok) {
    sendWsError(ws, joined.message, joined.code);
    return null;
  }
  return joined;
}

function send(ws: import("ws").WebSocket, msg: ServerMessage): void {
  safeWsSend(ws, msg);
}

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other server (Ctrl+C in its terminal), or run:\n` +
        `  npm run kill:server`,
    );
    process.exit(1);
  }
  logServerError("http:server", err);
  process.exit(1);
});

function shutdown(signal: string): void {
  console.log(`\n${signal} received — shutting down…`);
  shutdownAllRooms();
  wss.close();
  server.close(() => {
    closeDatabase(db);
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  logServerError("uncaughtException", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logServerError("unhandledRejection", reason);
});

server.listen(PORT, () => {
  console.log(`RTSBrowser server http://localhost:${PORT}`);
  console.log(`WebSocket game: ws://localhost:${PORT}/ws/game?token=<jwt>`);
});
