import {
  Router,
  type ErrorRequestHandler,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { ZodError } from "zod";
import type { AdminApiConfig } from "./config.js";
import { ContentStorage } from "./contentStorage.js";
import { createContentRouter } from "./contentRouter.js";
import { createDictionaryRouter } from "./dictionaryRouter.js";
import { createDraftsRouter } from "./draftsRouter.js";
import { createPublishRouter } from "./publishRouter.js";
import { HttpError } from "./httpError.js";

export function createAdminApiRouter(config: AdminApiConfig): Router {
  const router = Router();
  const contentStorage = new ContentStorage(config.stagingBucket);

  router.use(createContentRouter(config, contentStorage));
  router.use(createDictionaryRouter(contentStorage));
  router.use(createDraftsRouter(contentStorage));
  router.use(createPublishRouter(config, contentStorage));

  return router;
}

export function createAdminApiErrorHandler(): ErrorRequestHandler {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        error: error.message,
        details: error.details,
      });
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Ugyldig forespørsel",
        details: error.flatten(),
      });
      return;
    }

    console.error("[admin-api] Unexpected error", error);
    res.status(500).json({
      error: "Uventet feil",
    });
  };
}
