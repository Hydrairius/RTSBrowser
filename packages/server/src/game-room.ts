import {
  advanceTick,
  aiCommandsForTick,
  createSimState,
  hashState,
  toSnapshot,
  type SimState,
} from "@rtsbrowser/shared";
import type {
  ClientMessage,
  GameCommand,
  PlayerSlot,
  ServerMessage,
  TurnBundle,
} from "@rtsbrowser/shared";
import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { ErrorCode, logServerError, safeWsSend } from "./errors.js";

const TICK_MS = 200;
const AI_SLOT_ID = "ai-1";
/** v0 test harness: one human per room (AI fills the other slot). */
const MAX_HUMAN_PLAYERS = 1;

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  userId: string;
  displayName: string;
}

export type AddHumanResult =
  | { ok: true; playerId: string; slots: PlayerSlot[]; snapshot: ReturnType<typeof toSnapshot> }
  | { ok: false; message: string; code: string };

export class GameRoom {
  readonly id: string;
  private clients = new Map<string, ConnectedClient>();
  private pendingHuman = new Map<string, GameCommand>();
  private state: SimState;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(roomId?: string) {
    this.id = roomId ?? randomUUID().slice(0, 8);
    const humanSlot = { id: "pending", displayName: "Host", kind: "human" as const };
    this.state = createSimState(Date.now() & 0xffff, [
      humanSlot,
      { id: AI_SLOT_ID, displayName: "AI Opponent", kind: "ai" },
    ]);
  }

  humanCount(): number {
    return [...this.state.players.values()].filter((p) => p.kind === "human").length;
  }

  addHuman(
    ws: WebSocket,
    userId: string,
    displayName: string,
  ): AddHumanResult {
    const humans = this.humanCount();
    if (humans >= MAX_HUMAN_PLAYERS) {
      return {
        ok: false,
        message: "Room is full.",
        code: ErrorCode.ROOM_FULL,
      };
    }

    const playerId = `p-${randomUUID().slice(0, 8)}`;
    const client: ConnectedClient = { ws, playerId, userId, displayName };
    this.clients.set(playerId, client);

    try {
      if (this.clients.size === 1) {
        this.state = createSimState(this.state.seed, [
          { id: playerId, displayName, kind: "human" },
          { id: AI_SLOT_ID, displayName: "AI Opponent", kind: "ai" },
        ]);
        this.startTickLoop();
      } else {
        this.state.players.set(playerId, {
          id: playerId,
          displayName,
          kind: "human",
          x: 10 + this.state.players.size * 10,
          y: 20,
        });
        this.broadcast({ type: "player_joined", slot: slotFromPlayer(playerId, displayName, "human") });
      }

      return { ok: true, playerId, slots: this.slots(), snapshot: toSnapshot(this.state) };
    } catch (err) {
      this.clients.delete(playerId);
      logServerError(`room:${this.id}:addHuman`, err);
      return {
        ok: false,
        message: "Could not join room.",
        code: ErrorCode.INTERNAL,
      };
    }
  }

  removeClient(playerId: string): void {
    this.clients.delete(playerId);
    this.pendingHuman.delete(playerId);
    if (this.clients.size === 0) {
      this.stopTickLoop();
    }
  }

  getDebugInfo(): RoomDebugInfo {
    return {
      id: this.id,
      tick: this.state.tick,
      seed: this.state.seed,
      connectedClients: this.clients.size,
      humanPlayers: this.humanCount(),
      players: [...this.state.players.values()]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => ({
          id: p.id,
          displayName: p.displayName,
          kind: p.kind,
          x: p.x,
          y: p.y,
        })),
    };
  }

  /** Stop ticks and disconnect clients (graceful shutdown). */
  shutdown(): void {
    this.stopTickLoop();
    for (const client of this.clients.values()) {
      safeWsSend(client.ws, {
        type: "error",
        message: "Server is shutting down.",
        code: ErrorCode.INTERNAL,
      });
      try {
        client.ws.close(1001, "Server shutting down");
      } catch {
        /* socket may already be closed */
      }
    }
    this.clients.clear();
    this.pendingHuman.clear();
  }

  handleMessage(playerId: string, msg: ClientMessage): void {
    const client = this.clients.get(playerId);
    if (!client) return;

    try {
      switch (msg.type) {
        case "submit_command": {
          this.pendingHuman.set(playerId, {
            tick: this.state.tick,
            playerId,
            op: msg.op,
            dx: msg.dx,
            dy: msg.dy,
          });
          break;
        }
        case "ping":
          this.send(client, { type: "pong" });
          break;
        default:
          this.send(client, {
            type: "error",
            message: "Cannot handle that message after joining.",
            code: ErrorCode.UNKNOWN_MESSAGE,
          });
      }
    } catch (err) {
      logServerError(`room:${this.id}:handleMessage`, err);
      this.send(client, {
        type: "error",
        message: "Command failed.",
        code: ErrorCode.INTERNAL,
      });
    }
  }

  private startTickLoop(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.runTick(), TICK_MS);
  }

  private stopTickLoop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private runTick(): void {
    try {
      const tick = this.state.tick;
      const commands: GameCommand[] = [];

      for (const cmd of this.pendingHuman.values()) {
        if (cmd.tick === tick) commands.push(cmd);
      }
      this.pendingHuman.clear();

      commands.push(...aiCommandsForTick(this.state));

      this.state = advanceTick(this.state, commands);

      const turn: TurnBundle = {
        tick,
        commands,
        stateHash: hashState(this.state),
      };
      const snapshot = toSnapshot(this.state);

      this.broadcast({ type: "turn", turn, snapshot });
    } catch (err) {
      logServerError(`room:${this.id}:runTick`, err);
      this.broadcast({
        type: "error",
        message: "Simulation tick failed.",
        code: ErrorCode.INTERNAL,
      });
      this.stopTickLoop();
    }
  }

  private slots(): PlayerSlot[] {
    return [...this.state.players.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => slotFromPlayer(p.id, p.displayName, p.kind));
  }

  private broadcast(msg: ServerMessage): void {
    for (const client of this.clients.values()) {
      this.send(client, msg);
    }
  }

  private send(client: ConnectedClient, msg: ServerMessage): void {
    safeWsSend(client.ws, msg);
  }
}

function slotFromPlayer(
  id: string,
  displayName: string,
  kind: "human" | "ai",
): PlayerSlot {
  return { id, displayName, kind };
}

const rooms = new Map<string, GameRoom>();

export function getOrCreateRoom(roomId?: string): GameRoom {
  if (roomId) {
    let room = rooms.get(roomId);
    if (!room) {
      room = new GameRoom(roomId);
      rooms.set(roomId, room);
    }
    return room;
  }
  const room = new GameRoom();
  rooms.set(room.id, room);
  return room;
}

export function shutdownAllRooms(): void {
  for (const room of rooms.values()) {
    room.shutdown();
  }
  rooms.clear();
}

export interface RoomDebugInfo {
  id: string;
  tick: number;
  seed: number;
  connectedClients: number;
  humanPlayers: number;
  players: { id: string; displayName: string; kind: string; x: number; y: number }[];
}

export function getRoomsDebugSnapshot(): RoomDebugInfo[] {
  return [...rooms.values()].map((room) => room.getDebugInfo());
}

export function getRoomDebug(roomId: string): RoomDebugInfo | undefined {
  return rooms.get(roomId)?.getDebugInfo();
}
