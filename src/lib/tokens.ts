import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = "acc_";

export function generateRawToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
