import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AdminApiConfig } from "./config.js";
import { triggerContentPromotionBuild } from "./cloudBuild.js";
import { resolveUserContext } from "./auth.js";
import { ContentStorage } from "./contentStorage.js";
import { createLogger } from "../shared/logger.js";

const logger = createLogger({ prefix: 'publish' });

const PublishRequestSchema = z.object({
  targetEnvironment: z.literal("prod").default("prod"),
  changeSummary: z.string().min(5).max(1000),
  dryRun: z.boolean().optional(),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        collection: z.enum(["tiltak", "tilskudd"]).default("tiltak"),
        generation: z.string().min(1).optional(),
      })
    )
    .min(1),
});

export function createPublishRouter(config: AdminApiConfig, storage: ContentStorage) {
  const router = Router();

  router.post(
    "/publish",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = PublishRequestSchema.parse(req.body ?? {});
        const initiator = resolveUserContext(req);
        const requestId = req.header("x-request-id") ?? randomUUID();
        const isDryRun = parsed.dryRun ?? false;

        const result = await triggerContentPromotionBuild(config, {
          requestId,
          changeSummary: parsed.changeSummary.trim(),
          targetEnvironment: parsed.targetEnvironment,
          dryRun: isDryRun,
          items: parsed.items.map((item) => ({
            id: item.id.trim(),
            collection: item.collection,
            generation: item.generation?.trim(),
          })),
          initiatedBy: initiator,
          gitSha: config.gitSha,
        });

        // Slett draft-filer etter vellykket Cloud Build trigger (kun hvis ikke dry-run)
        if (!isDryRun) {
          const deletedDrafts: string[] = [];
          for (const item of parsed.items) {
            const draftPath = `${item.collection}/${item.id.trim()}.draft.json`;
            try {
              await storage.deleteJson(draftPath);
              deletedDrafts.push(draftPath);
            } catch (err) {
              // Logg feil, men ikke avbryt - Cloud Build er allerede trigget
              logger.warn(`Kunne ikke slette draft ${draftPath}:`, err);
            }
          }
          if (deletedDrafts.length > 0) {
            logger.info(`Slettet ${deletedDrafts.length} draft-filer: ${deletedDrafts.join(", ")}`);
          }
        }

        res.status(202).json({
          requestId,
          ...result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
