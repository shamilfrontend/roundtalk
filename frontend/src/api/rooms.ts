import { http } from "@/api/http";
import type { CreateRoomPayload, RoomListItem, RoomPublic } from "@/types/room";

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

export function parseRoomLink(raw: string): string | null {
  const trimmed = raw.trim();

  if (ROOM_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const fromPath = trimmed.match(/\/room\/([A-Za-z0-9_-]{6,32})\/?$/);

  if (fromPath?.[1] !== undefined) {
    return fromPath[1];
  }

  try {
    const url = new URL(trimmed);
    const fromUrl = url.pathname.match(/\/room\/([A-Za-z0-9_-]{6,32})\/?$/);

    return fromUrl?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function fetchPublicRoom(roomId: string): Promise<RoomPublic> {
  const { data } = await http.get<RoomPublic>(`/api/rooms/${roomId}`);

  return data;
}

export async function fetchHostRooms(): Promise<RoomListItem[]> {
  const { data } = await http.get<RoomListItem[]>("/api/rooms");

  return data;
}

export async function createRoom(
  payload: CreateRoomPayload = {},
): Promise<RoomListItem> {
  const { data } = await http.post<RoomListItem>("/api/rooms", payload);

  return data;
}

export async function endRoom(roomId: string): Promise<RoomListItem> {
  const { data } = await http.post<RoomListItem>(`/api/rooms/${roomId}/end`);

  return data;
}
