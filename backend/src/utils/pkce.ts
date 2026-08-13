import { createHash } from "node:crypto";
import { randomUrlToken } from "./ids.js";

export function createPkceVerifier(): string {
  return randomUrlToken(32);
}

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
