import {
  advanceTick,
  hashState,
  simFromSnapshot,
  type ClientMessage,
  type ServerMessage,
  type SimState,
} from "@rtsbrowser/shared";
import { getStoredToken } from "./api.js";

export type NetClientCallbacks = {
  onStatus: (text: string, level?: "ok" | "warn" | "err") => void;
  onRoom: (roomId: string, playerId: string) => void;
  onTurn: (tick: number, localHash: number, serverHash: number, inSync: boolean) => void;
  onPlayers: (rows: { id: string; name: string; kind: string; x: number; y: number }[]) => void;
};

export class NetTestClient {
  private ws: WebSocket | null = null;
  private localState: SimState | null = null;
  private playerId: string | null = null;

  constructor(private cb: NetClientCallbacks) {}

  connect(): void {
    const token = getStoredToken();
    if (!token) {
      this.cb.onStatus("Log in first.", "err");
      return;
    }

    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws/game?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.cb.onStatus("WebSocket connected.", "ok");
    this.ws.onclose = (ev) => {
      const hint =
        ev.code === 1006
          ? "Connection lost (server unreachable or rejected token)."
          : ev.reason
            ? `WebSocket closed: ${ev.reason}`
            : "WebSocket closed.";
      this.cb.onStatus(hint, "warn");
    };
    this.ws.onerror = () =>
      this.cb.onStatus("WebSocket error — check server is running.", "err");
    this.ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        this.cb.onStatus("Invalid message from server.", "err");
        return;
      }
      this.handleMessage(msg);
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.localState = null;
    this.playerId = null;
  }

  createRoom(displayName: string): void {
    this.send({ type: "create_room", displayName });
  }

  joinRoom(roomId: string, displayName: string): void {
    this.send({ type: "join_room", roomId: roomId.trim(), displayName });
  }

  move(dx: number, dy: number): void {
    if (!this.playerId) return;
    this.send({ type: "submit_command", op: "move", dx, dy });
  }

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "room_joined": {
        this.playerId = msg.playerId;
        this.localState = simFromSnapshot(msg.snapshot);
        this.cb.onRoom(msg.roomId, msg.playerId);
        this.cb.onStatus(`Joined room ${msg.roomId} as ${msg.playerId}`, "ok");
        this.cb.onPlayers(
          msg.snapshot.players.map((p) => ({
            id: p.id,
            name: p.displayName,
            kind: p.kind,
            x: p.x,
            y: p.y,
          })),
        );
        break;
      }
      case "player_joined":
        this.cb.onStatus(`Player joined: ${msg.slot.displayName}`, "ok");
        break;
      case "turn": {
        if (!this.localState) return;
        const beforeTick = this.localState.tick;
        this.localState = advanceTick(this.localState, msg.turn.commands);
        const localHash = hashState(this.localState);
        const serverHash = msg.snapshot.stateHash;
        const inSync = localHash === serverHash && this.localState.tick === msg.snapshot.tick;

        if (!inSync) {
          this.cb.onStatus(
            `DESYNC tick ${beforeTick}: local=${localHash} server=${serverHash}`,
            "err",
          );
        }

        this.cb.onTurn(beforeTick, localHash, serverHash, inSync);
        this.cb.onPlayers(
          msg.snapshot.players.map((p) => ({
            id: p.id,
            name: p.displayName,
            kind: p.kind,
            x: p.x,
            y: p.y,
          })),
        );
        break;
      }
      case "error": {
        const label = msg.code ? `${msg.message} (${msg.code})` : msg.message;
        this.cb.onStatus(label, "err");
        break;
      }
      case "pong":
        break;
    }
  }
}
