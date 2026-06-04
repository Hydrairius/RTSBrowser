import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ErrorCode, HttpError, logServerError } from "./errors.js";

export type AppDatabase = DatabaseSync;

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export function openDatabase(databasePath: string): AppDatabase {
  try {
    const dir = path.dirname(databasePath);
    fs.mkdirSync(dir, { recursive: true });

    const db = new DatabaseSync(databasePath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    return db;
  } catch (err) {
    logServerError("db:open", err);
    throw new HttpError(
      500,
      `Could not open database at ${databasePath}. Check permissions and DATABASE_PATH.`,
      ErrorCode.DATABASE,
    );
  }
}

export function closeDatabase(db: AppDatabase): void {
  try {
    db.close();
  } catch (err) {
    logServerError("db:close", err);
  }
}

export function findUserByEmail(db: AppDatabase, email: string): DbUser | undefined {
  try {
    return db
      .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
      .get(email.trim().toLowerCase()) as DbUser | undefined;
  } catch (err) {
    logServerError("db:findUserByEmail", err);
    throw new HttpError(500, "Database error.", ErrorCode.DATABASE);
  }
}

export function findUserById(db: AppDatabase, id: string): DbUser | undefined {
  try {
    return db
      .prepare("SELECT id, email, password_hash, created_at FROM users WHERE id = ?")
      .get(id) as DbUser | undefined;
  } catch (err) {
    logServerError("db:findUserById", err);
    throw new HttpError(500, "Database error.", ErrorCode.DATABASE);
  }
}

export function insertUser(
  db: AppDatabase,
  user: { id: string; email: string; password_hash: string },
): void {
  try {
    db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
      user.id,
      user.email.trim().toLowerCase(),
      user.password_hash,
    );
  } catch (err) {
    if (isSqliteUniqueViolation(err)) {
      throw new HttpError(409, "Email already registered.", ErrorCode.CONFLICT);
    }
    logServerError("db:insertUser", err);
    throw new HttpError(500, "Database error.", ErrorCode.DATABASE);
  }
}

function isSqliteUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}
