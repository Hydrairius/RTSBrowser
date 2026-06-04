import type { GameCommand, PlayerView, SimSnapshot } from "./protocol.js";

export interface SimPlayer {
  id: string;
  displayName: string;
  kind: "human" | "ai";
  x: number;
  y: number;
}

export interface SimState {
  tick: number;
  seed: number;
  players: Map<string, SimPlayer>;
}

const MAP_CENTER = { x: 50, y: 50 };

export function createSimState(
  seed: number,
  slots: { id: string; displayName: string; kind: "human" | "ai" }[],
): SimState {
  const players = new Map<string, SimPlayer>();
  slots.forEach((slot, i) => {
    players.set(slot.id, {
      id: slot.id,
      displayName: slot.displayName,
      kind: slot.kind,
      x: 10 + i * 15,
      y: 10,
    });
  });
  return { tick: 0, seed, players };
}

export function hashState(state: SimState): number {
  let h = state.tick ^ (state.seed * 2654435761);
  const ids = [...state.players.keys()].sort();
  for (const id of ids) {
    const p = state.players.get(id)!;
    h = (h * 31 + p.x) | 0;
    h = (h * 31 + p.y) | 0;
  }
  return h >>> 0;
}

export function simFromSnapshot(snapshot: SimSnapshot): SimState {
  const players = new Map<string, SimPlayer>();
  for (const p of snapshot.players) {
    players.set(p.id, {
      id: p.id,
      displayName: p.displayName,
      kind: p.kind,
      x: p.x,
      y: p.y,
    });
  }
  return { tick: snapshot.tick, seed: snapshot.seed, players };
}

export function toSnapshot(state: SimState): SimSnapshot {
  const players: PlayerView[] = [...state.players.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      kind: p.kind,
      x: p.x,
      y: p.y,
    }));
  return {
    tick: state.tick,
    seed: state.seed,
    players,
    stateHash: hashState(state),
  };
}

/** Apply all commands for one tick, then advance tick counter. */
export function advanceTick(state: SimState, commands: GameCommand[]): SimState {
  const next: SimState = {
    tick: state.tick,
    seed: state.seed,
    players: new Map(
      [...state.players.entries()].map(([id, p]) => [id, { ...p }]),
    ),
  };

  const sorted = [...commands].sort((a, b) => a.playerId.localeCompare(b.playerId));

  for (const cmd of sorted) {
    if (cmd.tick !== next.tick) continue;
    const player = next.players.get(cmd.playerId);
    if (!player) continue;

    if (cmd.op === "move") {
      const dx = cmd.dx ?? 0;
      const dy = cmd.dy ?? 0;
      player.x = clamp(player.x + dx, 0, 100);
      player.y = clamp(player.y + dy, 0, 100);
    }
  }

  next.tick += 1;
  return next;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Deterministic AI stub: march toward map center.
 * Only the server should call this for the test harness; commands are broadcast.
 */
export function aiCommandsForTick(state: SimState): GameCommand[] {
  const commands: GameCommand[] = [];
  for (const player of state.players.values()) {
    if (player.kind !== "ai") continue;
    const dx = Math.sign(MAP_CENTER.x - player.x);
    const dy = Math.sign(MAP_CENTER.y - player.y);
    if (dx === 0 && dy === 0) {
      commands.push({
        tick: state.tick,
        playerId: player.id,
        op: "noop",
      });
    } else {
      commands.push({
        tick: state.tick,
        playerId: player.id,
        op: "move",
        dx,
        dy,
      });
    }
  }
  return commands;
}
