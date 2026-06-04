/** Wire protocol for auth + networking test harness. */

export type PlayerKind = "human" | "ai";

export interface PlayerSlot {
  id: string;
  displayName: string;
  kind: PlayerKind;
  userId?: string;
}

export type CommandOp = "noop" | "move";

export interface GameCommand {
  tick: number;
  playerId: string;
  op: CommandOp;
  /** Integer delta for move test (deterministic). */
  dx?: number;
  dy?: number;
}

export interface TurnBundle {
  tick: number;
  commands: GameCommand[];
  stateHash: number;
}

export interface PlayerView {
  id: string;
  displayName: string;
  kind: PlayerKind;
  x: number;
  y: number;
}

export interface SimSnapshot {
  tick: number;
  seed: number;
  players: PlayerView[];
  stateHash: number;
}

// --- Client → Server (WebSocket) ---

export type ClientMessage =
  | { type: "join_room"; roomId: string; displayName: string }
  | { type: "create_room"; displayName: string }
  | { type: "submit_command"; op: CommandOp; dx?: number; dy?: number }
  | { type: "ping" };

// --- Server → Client ---

export type ServerMessage =
  | {
      type: "room_joined";
      roomId: string;
      playerId: string;
      slots: PlayerSlot[];
      snapshot: SimSnapshot;
    }
  | { type: "turn"; turn: TurnBundle; snapshot: SimSnapshot }
  | { type: "player_joined"; slot: PlayerSlot }
  | { type: "error"; message: string; code?: string }
  | { type: "pong" };

export interface ApiErrorBody {
  error: string;
  code?: string;
}

// --- HTTP auth ---

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
