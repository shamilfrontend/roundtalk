export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatElapsed(startedAt: number, now: number): string {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export const ROOM_STATUS_LABEL: Record<string, string> = {
  live: "Идёт",
  ended: "Завершена",
};
