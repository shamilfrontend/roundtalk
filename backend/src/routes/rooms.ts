import { Router } from "express";
import { asyncHandler } from "../middleware/error-handler.js";
import { getAuthUser, requireAuth } from "../middleware/require-auth.js";
import {
  createRoom,
  endRoomByHost,
  getPublicRoom,
  listHostRooms,
  updateScheduledRoom,
} from "../services/rooms.js";
import { disconnectRoom } from "../sockets/io.js";
import {
  readBody,
  readStringParam,
  validateDurationMin,
  validateRoomId,
  validateScheduledAt,
  validateTitle,
} from "../utils/validate.js";

export const roomsRouter = Router();

roomsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    const user = getAuthUser(req);
    const room = await createRoom({
      hostId: user.id,
      title: validateTitle(body.title),
      scheduledAt: validateScheduledAt(body.scheduledAt),
      durationMin: validateDurationMin(body.durationMin),
    });

    res.status(201).json(room);
  }),
);

roomsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getAuthUser(req);
    const rooms = await listHostRooms(user.id);

    res.json(rooms);
  }),
);

roomsRouter.get(
  "/:roomId",
  asyncHandler(async (req, res) => {
    const roomId = validateRoomId(readStringParam(req.params.roomId, "roomId"));
    const room = await getPublicRoom(roomId);

    res.json(room);
  }),
);

roomsRouter.patch(
  "/:roomId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const roomId = validateRoomId(readStringParam(req.params.roomId, "roomId"));
    const body = readBody(req.body);
    const user = getAuthUser(req);
    const room = await updateScheduledRoom({
      roomId,
      hostId: user.id,
      title: validateTitle(body.title),
      scheduledAt: validateScheduledAt(body.scheduledAt),
      durationMin: validateDurationMin(body.durationMin),
    });

    res.json(room);
  }),
);

roomsRouter.post(
  "/:roomId/end",
  requireAuth,
  asyncHandler(async (req, res) => {
    const roomId = validateRoomId(readStringParam(req.params.roomId, "roomId"));
    const user = getAuthUser(req);
    const room = await endRoomByHost(roomId, user.id);

    await disconnectRoom(roomId);
    res.json(room);
  }),
);
