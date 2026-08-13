import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket.js";

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

let io: IoServer | undefined;

const screenShares = new Map<string, string>();
const lastReactionAt = new Map<string, number>();

export function setIo(server: IoServer): void {
  io = server;
}

export function getIo(): IoServer {
  if (io === undefined) {
    throw new Error("Socket.io is not initialized");
  }

  return io;
}

export function getScreenShareSocketId(roomId: string): string | null {
  return screenShares.get(roomId) ?? null;
}

export function tryStartScreenShare(roomId: string, socketId: string): boolean {
  const current = screenShares.get(roomId);

  if (current !== undefined && current !== socketId) {
    return false;
  }

  screenShares.set(roomId, socketId);
  return true;
}

export function stopScreenShare(roomId: string, socketId: string): boolean {
  if (screenShares.get(roomId) !== socketId) {
    return false;
  }

  screenShares.delete(roomId);
  return true;
}

export function consumeReactionSlot(socketId: string): boolean {
  const now = Date.now();
  const last = lastReactionAt.get(socketId) ?? 0;

  if (now - last < 1000) {
    return false;
  }

  lastReactionAt.set(socketId, now);
  return true;
}

export function cleanupSocketMedia(roomId: string | undefined, socketId: string): boolean {
  lastReactionAt.delete(socketId);

  if (roomId === undefined) {
    return false;
  }

  return stopScreenShare(roomId, socketId);
}

export async function disconnectRoom(roomId: string): Promise<void> {
  screenShares.delete(roomId);

  if (io === undefined) {
    return;
  }

  io.to(roomId).emit("room-ended");
  const sockets = await io.in(roomId).fetchSockets();

  for (const socket of sockets) {
    lastReactionAt.delete(socket.id);
    socket.disconnect(true);
  }
}

export function createIo(httpServer: HttpServer): IoServer {
  return new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  });
}
