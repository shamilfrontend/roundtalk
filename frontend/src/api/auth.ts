import { http } from "@/api/http";
import type { AuthUser } from "@/types/auth";

export function getAuthApiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL.replace(/\/$/, "");

  return `${base}${path}`;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>("/api/auth/me");

  return data;
}

export async function logoutRequest(): Promise<void> {
  await http.post("/api/auth/logout");
}
