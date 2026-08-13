import { randomBytes } from "node:crypto";

export function createRoomId(): string {
  return randomBytes(9).toString("base64url");
}

export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
