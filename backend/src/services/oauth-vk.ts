import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import { isRecord, readJsonUnknown } from "../utils/json.js";
import { createPkceChallenge, createPkceVerifier } from "../utils/pkce.js";

function requireVkConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = env.vkClientId;
  const clientSecret = env.vkClientSecret;
  const redirectUri = env.vkRedirectUri;

  if (
    clientId === undefined ||
    clientSecret === undefined ||
    redirectUri === undefined
  ) {
    throw new HttpError(
      503,
      "oauth_not_configured",
      "Вход через VK не настроен",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function createVkPkce(): { verifier: string; challenge: string } {
  const verifier = createPkceVerifier();

  return {
    verifier,
    challenge: createPkceChallenge(verifier),
  };
}

export function buildVkAuthorizeUrl(state: string, challenge: string): string {
  const { clientId, redirectUri } = requireVkConfig();
  const url = new URL("https://id.vk.ru/authorize");

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

function readVkUser(payload: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(payload.user)) {
    return payload.user;
  }

  return payload;
}

export async function fetchVkProfile(input: {
  code: string;
  codeVerifier: string;
  deviceId: string;
  state: string;
}): Promise<{
  vkId: string;
  email: string;
  name: string;
}> {
  const { clientId, clientSecret, redirectUri } = requireVkConfig();
  const tokenResponse = await fetch("https://id.vk.ru/oauth2/auth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: clientId,
      client_secret: clientSecret,
      device_id: input.deviceId,
      redirect_uri: redirectUri,
      state: input.state,
    }),
  });

  if (!tokenResponse.ok) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через VK");
  }

  const tokenPayload = await readJsonUnknown(tokenResponse);

  if (!isRecord(tokenPayload) || typeof tokenPayload.access_token !== "string") {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через VK");
  }

  const infoResponse = await fetch("https://id.vk.ru/oauth2/user_info", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      access_token: tokenPayload.access_token,
    }),
  });

  if (!infoResponse.ok) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через VK");
  }

  const infoPayload = await readJsonUnknown(infoResponse);

  if (!isRecord(infoPayload)) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через VK");
  }

  const user = readVkUser(infoPayload);
  const idValue = user.user_id ?? user.id;
  const vkId =
    typeof idValue === "string" || typeof idValue === "number"
      ? String(idValue)
      : undefined;
  const email = typeof user.email === "string" ? user.email : undefined;
  const firstName = typeof user.first_name === "string" ? user.first_name : "";
  const lastName = typeof user.last_name === "string" ? user.last_name : "";
  const name = `${firstName} ${lastName}`.trim() || "Пользователь";

  if (vkId === undefined) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через VK");
  }

  if (email === undefined || email.length === 0) {
    throw new HttpError(400, "email_required", "Разрешите доступ к email");
  }

  return { vkId, email, name };
}
