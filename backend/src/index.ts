import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { createServer } from "node:http";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { authRouter } from "./routes/auth.js";
import { roomsRouter } from "./routes/rooms.js";
import { turnRouter } from "./routes/turn.js";
import { attachSockets } from "./sockets/index.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(
  morgan("dev", {
    skip: (req) => req.path.startsWith("/api/auth/"),
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/turn", turnRouter);
app.use(errorHandler);

const httpServer = createServer(app);

attachSockets(httpServer);

async function main(): Promise<void> {
  await connectDb();
  httpServer.listen(env.port, () => {
    console.log(`Backend listening on port ${env.port}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
