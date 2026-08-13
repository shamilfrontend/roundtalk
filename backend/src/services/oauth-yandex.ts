import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import { isRecord, readJsonUnknown } from "../utils/json.js";

function requireYandexConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = env.yandexClientId;
  const clientSecret = env.yandexClientSecret;
  const redirectUri = env.yandexRedirectUri;

  if (
    clientId === undefined ||
    clientSecret === undefined ||
    redirectUri === undefined
  ) {
    throw new HttpError(
      503,
      "oauth_not_configured",
      "Вход через Яндекс не настроен",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildYandexAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = requireYandexConfig();
  const url = new URL("https://oauth.yandex.ru/authorize");

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "login:email login:info");
  url.searchParams.set("state", state);

  return url.toString();
}

function readEmail(info: Record<string, unknown>): string | undefined {
  if (typeof info.default_email === "string" && info.default_email.length > 0) {
    return info.default_email;
  }

  if (Array.isArray(info.emails)) {
    const first = info.emails.find(
      (item): item is string => typeof item === "string" && item.length > 0,
    );

    if (first !== undefined) {
      return first;
    }
  }

  return undefined;
}

function readName(info: Record<string, unknown>): string {
  const candidates = [info.display_name, info.real_name, info.first_name, info.login];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "Пользователь";
}

export async function fetchYandexProfile(code: string): Promise<{
  yandexId: string;
  email: string;
  name: string;
}> {
  const { clientId, clientSecret, redirectUri } = requireYandexConfig();
  const tokenResponse = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через Яндекс");
  }

  const tokenPayload = await readJsonUnknown(tokenResponse);

  if (!isRecord(tokenPayload) || typeof tokenPayload.access_token !== "string") {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через Яндекс");
  }

  const infoResponse = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${tokenPayload.access_token}` },
  });

  if (!infoResponse.ok) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через Яндекс");
  }

  const infoPayload = await readJsonUnknown(infoResponse);

  if (!isRecord(infoPayload)) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через Яндекс");
  }

  const idValue = infoPayload.id;
  const yandexId =
    typeof idValue === "string" || typeof idValue === "number"
      ? String(idValue)
      : undefined;
  const email = readEmail(infoPayload);

  if (yandexId === undefined) {
    throw new HttpError(502, "oauth_provider_error", "Не удалось войти через Яндекс");
  }

  if (email === undefined) {
    throw new HttpError(400, "email_required", "Разрешите доступ к email");
  }

  return {
    yandexId,
    email,
    name: readName(infoPayload),
  };
}
