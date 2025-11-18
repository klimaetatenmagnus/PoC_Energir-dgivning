import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AdminApiConfig } from "./config.js";
import { triggerContentPromotionBuild } from "./cloudBuild.js";
import { resolveUserContext } from "./auth.js";

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

export function createPublishRouter(config: AdminApiConfig) {
  const router = Router();

  router.post(
    "/publish",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = PublishRequestSchema.parse(req.body ?? {});
        const initiator = resolveUserContext(req);
        const requestId = req.header("x-request-id") ?? randomUUID();

        const result = await triggerContentPromotionBuild(config, {
          requestId,
          changeSummary: parsed.changeSummary.trim(),
          targetEnvironment: parsed.targetEnvironment,
          dryRun: parsed.dryRun ?? false,
          items: parsed.items.map((item) => ({
            id: item.id.trim(),
            collection: item.collection,
            generation: item.generation?.trim(),
          })),
          initiatedBy: initiator,
          gitSha: config.gitSha,
        });

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
