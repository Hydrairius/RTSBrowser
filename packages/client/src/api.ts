import type { ApiErrorBody, AuthResponse, AuthUser } from "@rtsbrowser/shared";

const TOKEN_KEY = "rtsbrowser_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function jsonFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data?: T; error?: string; code?: string; status: number }> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(path, { ...init, headers });
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;
    if (!res.ok) {
      return {
        error: body.error ?? res.statusText ?? "Request failed.",
        code: body.code,
        status: res.status,
      };
    }
    return { data: body as T, status: res.status };
  } catch {
    return {
      error: "Cannot reach server. Is it running on port 3001?",
      code: "NETWORK",
      status: 0,
    };
  }
}

export async function register(
  email: string,
  password: string,
): Promise<AuthResponse | string> {
  const { data, error } = await jsonFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (error) return error;
  setStoredToken(data!.token);
  return data!;
}

export async function login(email: string, password: string): Promise<AuthResponse | string> {
  const { data, error } = await jsonFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (error) return error;
  setStoredToken(data!.token);
  return data!;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const { data, error, status } = await jsonFetch<{ user: AuthUser }>("/api/auth/me");
  if (error) {
    if (status === 401) setStoredToken(null);
    return null;
  }
  return data!.user;
}

export function logout(): void {
  setStoredToken(null);
}
