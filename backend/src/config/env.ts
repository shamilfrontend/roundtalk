import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];

  return value === undefined || value === "" ? undefined : value;
}

function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const portRaw = required("PORT");
const port = Number(portRaw);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

const turnUrlsRaw = optional("TURN_URLS");

export const env = {
  port,
  corsOrigins: parseList(required("CORS_ORIGIN")),
  mongoUri: required("MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN") ?? "15m",
  turnSecret: optional("TURN_SECRET"),
  turnUrls: turnUrlsRaw
    ? parseList(turnUrlsRaw)
    : ["stun:stun.l.google.com:19302"],
  clientUrl: required("CLIENT_URL").replace(/\/$/, ""),
  yandexClientId: optional("YANDEX_CLIENT_ID"),
  yandexClientSecret: optional("YANDEX_CLIENT_SECRET"),
  yandexRedirectUri: optional("YANDEX_REDIRECT_URI"),
  vkClientId: optional("VK_CLIENT_ID"),
  vkClientSecret: optional("VK_CLIENT_SECRET"),
  vkRedirectUri: optional("VK_REDIRECT_URI"),
};
