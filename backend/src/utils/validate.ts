import { HttpError } from "./http-error.js";
import { isRecord } from "./json.js";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const CHAT_TEXT_MAX = 1000;
export const TITLE_MAX = 120;
export const DURATION_MIN_DEFAULT = 60;
export const DURATION_MIN_MAX = 1440;
export const EMOJI_MAX = 16;
export const MAX_ROOM_PARTICIPANTS = 6;

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readStringParam(
  value: string | string[] | undefined,
  field: string,
): string {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new HttpError(400, "invalid_params", `Некорректный ${field}`);
  }

  return raw.trim();
}

export function validateDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_display_name", "Укажите имя");
  }

  const name = value.trim();

  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    throw new HttpError(
      400,
      "invalid_display_name",
      `Имя: ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} символов`,
    );
  }

  return name;
}

export function validateChatText(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_message", "Некорректное сообщение");
  }

  const text = value.trim().replace(/<[^>]*>/g, "").trim();

  if (text.length === 0 || text.length > CHAT_TEXT_MAX) {
    throw new HttpError(
      400,
      "invalid_message",
      `Сообщение: 1–${CHAT_TEXT_MAX} символов`,
    );
  }

  return text;
}

export function validateTitle(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_title", "Некорректное название");
  }

  const title = value.trim();

  if (title.length === 0) {
    return undefined;
  }

  if (title.length > TITLE_MAX) {
    throw new HttpError(
      400,
      "invalid_title",
      `Название до ${TITLE_MAX} символов`,
    );
  }

  return title;
}

export function validateDurationMin(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, "invalid_duration", "Некорректная длительность");
  }

  if (value > DURATION_MIN_MAX) {
    throw new HttpError(400, "invalid_duration", "Некорректная длительность");
  }

  return value;
}

export function validateScheduledAt(value: unknown): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "invalid_scheduled_at", "Некорректная дата");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "invalid_scheduled_at", "Некорректная дата");
  }

  return date;
}

export function validateEmoji(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_reaction", "Некорректная реакция");
  }

  const emoji = value.trim();

  if (emoji.length === 0 || emoji.length > EMOJI_MAX) {
    throw new HttpError(400, "invalid_reaction", "Некорректная реакция");
  }

  return emoji;
}

export function validateRoomId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{6,32}$/.test(value)) {
    throw new HttpError(400, "invalid_room_id", "Некорректный идентификатор");
  }

  return value;
}

export function readBody(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isRecord(value)) {
    throw new HttpError(400, "invalid_body", "Некорректное тело запроса");
  }

  return value;
}
