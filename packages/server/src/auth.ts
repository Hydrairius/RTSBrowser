import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AuthResponse, AuthUser } from "@rtsbrowser/shared";
import { HttpError } from "./errors.js";
import type { AppDatabase } from "./db.js";
import { findUserByEmail, findUserById, insertUser } from "./db.js";

const SALT_ROUNDS = 12;

export interface JwtPayload {
  sub: string;
  email: string;
}

export function registerUser(
  db: AppDatabase,
  jwtSecret: string,
  email: string,
  password: string,
): AuthResponse | { error: string; code?: string } {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || password.length < 8) {
    return { error: "Invalid email or password (min 8 characters).", code: "VALIDATION" };
  }

  if (findUserByEmail(db, normalized)) {
    return { error: "Email already registered.", code: "CONFLICT" };
  }

  const id = randomUUID();
  const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);
  insertUser(db, { id, email: normalized, password_hash });

  return issueToken(jwtSecret, { id, email: normalized });
}

export function loginUser(
  db: AppDatabase,
  jwtSecret: string,
  email: string,
  password: string,
): AuthResponse | { error: string; code?: string } {
  const user = findUserByEmail(db, email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return { error: "Invalid email or password.", code: "UNAUTHORIZED" };
  }

  return issueToken(jwtSecret, { id: user.id, email: user.email });
}

function issueToken(jwtSecret: string, user: { id: string; email: string }): AuthResponse {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  const token = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
  return {
    token,
    user: { id: user.id, email: user.email },
  };
}

export function verifyToken(jwtSecret: string, token: string): JwtPayload | null {
  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function authMiddleware(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token =
      header?.startsWith("Bearer ") ? header.slice(7) : (req.query.token as string | undefined);

    if (!token) {
      res.status(401).json({ error: "Missing token.", code: "UNAUTHORIZED" });
      return;
    }

    const payload = verifyToken(jwtSecret, token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token.", code: "UNAUTHORIZED" });
      return;
    }

    req.user = payload;
    next();
  };
}

export function getAuthUser(db: AppDatabase, payload: JwtPayload): AuthUser | null {
  try {
    const row = findUserById(db, payload.sub);
    if (!row) return null;
    return { id: row.id, email: row.email };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw err;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}
