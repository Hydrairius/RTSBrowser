import type { AppDatabase } from "./db.js";
import { getRoomsDebugSnapshot } from "./game-room.js";

export interface DevSnapshot {
  at: string;
  nodeEnv: string;
  uptimeSec: number;
  databasePath: string;
  userCount: number;
  rooms: ReturnType<typeof getRoomsDebugSnapshot>;
}

export function buildDevSnapshot(db: AppDatabase, databasePath: string): DevSnapshot {
  const userCount = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  return {
    at: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? "development",
    uptimeSec: Math.round(process.uptime() * 10) / 10,
    databasePath,
    userCount,
    rooms: getRoomsDebugSnapshot(),
  };
}

export function isDevDebugEnabled(): boolean {
  if (process.env.ENABLE_DEV_API === "1") return true;
  if (process.env.ENABLE_DEV_API === "0") return false;
  return process.env.NODE_ENV !== "production";
}
