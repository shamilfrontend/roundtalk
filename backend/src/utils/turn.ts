import { createHmac, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const TURN_TTL_SEC = 86_400;

export interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export function getIceServers(): { iceServers: IceServer[] } {
  const secret = env.turnSecret;
  const urls = env.turnUrls;

  if (secret === undefined) {
    return {
      iceServers: urls
        .filter((url) => url.startsWith("stun:"))
        .map((url) => ({ urls: url })),
    };
  }

  const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_SEC}:${randomBytes(8).toString("hex")}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");

  const iceServers: IceServer[] = urls.map((url) => {
    if (url.startsWith("turn:") || url.startsWith("turns:")) {
      return { urls: url, username, credential };
    }

    return { urls: url };
  });

  return { iceServers };
}
