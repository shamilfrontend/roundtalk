import { http } from "@/api/http";

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface IceServersPayload {
  iceServers: IceServer[];
}

export const FALLBACK_ICE_SERVERS: IceServersPayload = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function isIceServer(value: unknown): value is IceServer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("urls" in value) || typeof value.urls !== "string") {
    return false;
  }

  if (
    "username" in value &&
    value.username !== undefined &&
    typeof value.username !== "string"
  ) {
    return false;
  }

  if (
    "credential" in value &&
    value.credential !== undefined &&
    typeof value.credential !== "string"
  ) {
    return false;
  }

  return true;
}

function parsePayload(data: unknown): IceServersPayload | null {
  if (typeof data !== "object" || data === null || !("iceServers" in data)) {
    return null;
  }

  if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
    return null;
  }

  const iceServers: IceServer[] = [];

  for (const item of data.iceServers) {
    if (!isIceServer(item)) {
      return null;
    }

    iceServers.push(item);
  }

  return { iceServers };
}

export async function fetchIceServers(): Promise<IceServersPayload> {
  try {
    const { data } = await http.get<unknown>("/api/turn");
    const parsed = parsePayload(data);

    if (parsed !== null) {
      return parsed;
    }
  } catch {
    return FALLBACK_ICE_SERVERS;
  }

  return FALLBACK_ICE_SERVERS;
}
