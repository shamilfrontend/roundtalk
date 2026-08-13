import { Router } from "express";
import { getIceServers } from "../utils/turn.js";

export const turnRouter = Router();

turnRouter.get("/", (_req, res) => {
  res.json(getIceServers());
});
