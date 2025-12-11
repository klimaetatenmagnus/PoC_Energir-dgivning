import express, { type Request, type Response } from "express";
import process from "node:process";
import { loadAdminApiConfig } from "./config.js";
import {
  createAdminApiRouter,
  createAdminApiErrorHandler,
} from "./router.js";
import { createLogger } from "../shared/logger.js";

const logger = createLogger({ prefix: 'admin-api' });

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection", error);
});
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
});

const config = loadAdminApiConfig();
const app = express();

app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "admin-api",
    projectId: config.projectId,
    target: config.prodBucket,
  });
});

app.use("/admin/api", createAdminApiRouter(config));
app.use(createAdminApiErrorHandler());

app.listen(config.port, () => {
  logger.info(
    `listening on port ${config.port} (project=${config.projectId}, location=${config.cloudBuildLocation})`
  );
});
