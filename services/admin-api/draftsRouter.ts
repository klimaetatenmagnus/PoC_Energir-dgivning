import { Router } from "express";
import { TiltakContentSchema, type TiltakContent } from "../../content/tiltak/schema";
import { TilskuddContentSchema, type TilskuddContent } from "../../content/tilskudd/schema";
import { resolveUserContext } from "./auth.js";
import { ContentStorage } from "./contentStorage.js";
import { HttpError } from "./httpError.js";
import { createLogger } from "../shared/logger.js";

const logger = createLogger({ prefix: 'drafts' });

export interface DraftSummary {
  id: string;
  collection: "tiltak" | "tilskudd";
  title: string;
  changeSummary?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface DraftsListResponse {
  drafts: DraftSummary[];
  count: number;
}

export interface SyncStagingResponse {
  success: boolean;
  synced: Array<{ id: string; collection: "tiltak" | "tilskudd" }>;
  stagingUrl: string;
}

const STAGING_URL = "https://staging.xn--energinkkelen-hnb.no";

export function createDraftsRouter(storage: ContentStorage): Router {
  const router = Router();

  /**
   * GET /drafts
   * Lister alle draft-filer (tiltak + tilskudd)
   */
  router.get("/drafts", async (_req, res, next) => {
    try {
      const drafts: DraftSummary[] = [];

      // Finn alle tiltak-drafts
      const tiltakDraftFiles = await storage.listFiles("tiltak/*.draft.json");
      for (const file of tiltakDraftFiles) {
        try {
          const { data } = await storage.readJson<TiltakContent>(file.path);
          const parsed = TiltakContentSchema.parse(data);
          drafts.push({
            id: parsed.id,
            collection: "tiltak",
            title: parsed.title,
            changeSummary: parsed.metadata.changeSummary,
            updatedAt: parsed.metadata.updatedAt,
            updatedBy: parsed.metadata.updatedBy,
          });
        } catch (error) {
          logger.warn(`Kunne ikke lese tiltak-draft ${file.path}:`, error);
        }
      }

      // Finn alle tilskudd-drafts
      const tilskuddDraftFiles = await storage.listFiles("tilskudd/*.draft.json");
      for (const file of tilskuddDraftFiles) {
        try {
          const { data } = await storage.readJson<TilskuddContent>(file.path);
          const parsed = TilskuddContentSchema.parse(data);
          drafts.push({
            id: parsed.id,
            collection: "tilskudd",
            title: parsed.title,
            changeSummary: parsed.metadata.changeSummary,
            updatedAt: parsed.metadata.updatedAt,
            updatedBy: parsed.metadata.updatedBy,
          });
        } catch (error) {
          logger.warn(`Kunne ikke lese tilskudd-draft ${file.path}:`, error);
        }
      }

      // Sorter etter updatedAt (nyeste først)
      drafts.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      const response: DraftsListResponse = {
        drafts,
        count: drafts.length,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /drafts/sync-staging
   * Kopierer alle draft-filer til sine respektive hovedfiler i staging-bøtten.
   * Dette gjør at staging-frontend viser oppdatert innhold.
   */
  router.post("/drafts/sync-staging", async (req, res, next) => {
    try {
      const actor = resolveUserContext(req);
      const synced: Array<{ id: string; collection: "tiltak" | "tilskudd" }> = [];

      // Finn og synk alle tiltak-drafts
      const tiltakDraftFiles = await storage.listFiles("tiltak/*.draft.json");
      for (const file of tiltakDraftFiles) {
        try {
          const { data } = await storage.readJson<TiltakContent>(file.path);
          const parsed = TiltakContentSchema.parse(data);

          // Oppdater metadata for staging-sync
          const now = new Date().toISOString();
          const stagedContent: TiltakContent = {
            ...parsed,
            metadata: {
              ...parsed.metadata,
              // Setter status til "published" slik at staging-frontend kan lese filen
              status: "published",
              updatedAt: now,
              updatedBy: actor.email,
            },
          };

          // Skriv til hovedfilen (ikke draft-filen)
          const mainPath = `tiltak/${parsed.id}.json`;
          await storage.writeJson(mainPath, stagedContent);

          synced.push({ id: parsed.id, collection: "tiltak" });
          logger.info(`${actor.email} synket tiltak ${parsed.id} til staging`);
        } catch (error) {
          logger.error(`Feil ved synking av tiltak-draft ${file.path}:`, error);
        }
      }

      // Finn og synk alle tilskudd-drafts
      const tilskuddDraftFiles = await storage.listFiles("tilskudd/*.draft.json");
      for (const file of tilskuddDraftFiles) {
        try {
          const { data } = await storage.readJson<TilskuddContent>(file.path);
          const parsed = TilskuddContentSchema.parse(data);

          // Oppdater metadata for staging-sync
          const now = new Date().toISOString();
          const stagedContent: TilskuddContent = {
            ...parsed,
            metadata: {
              ...parsed.metadata,
              // Setter status til "published" slik at staging-frontend kan lese filen
              status: "published",
              updatedAt: now,
              updatedBy: actor.email,
            },
          };

          // Skriv til hovedfilen (ikke draft-filen)
          const mainPath = `tilskudd/${parsed.id}.json`;
          await storage.writeJson(mainPath, stagedContent);

          synced.push({ id: parsed.id, collection: "tilskudd" });
          logger.info(`${actor.email} synket tilskudd ${parsed.id} til staging`);
        } catch (error) {
          logger.error(`Feil ved synking av tilskudd-draft ${file.path}:`, error);
        }
      }

      if (synced.length === 0) {
        throw new HttpError(404, "Ingen draft-filer funnet å synkronisere");
      }

      const response: SyncStagingResponse = {
        success: true,
        synced,
        stagingUrl: STAGING_URL,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /drafts/discard-all
   * Sletter alle draft-filer uten å publisere.
   * Brukes for å nullstille upubliserte endringer.
   */
  router.delete("/drafts/discard-all", async (req, res, next) => {
    try {
      const actor = resolveUserContext(req);
      const discarded: Array<{ id: string; collection: "tiltak" | "tilskudd" }> = [];

      // Finn og slett alle tiltak-drafts
      const tiltakDraftFiles = await storage.listFiles("tiltak/*.draft.json");
      for (const file of tiltakDraftFiles) {
        try {
          // Hent ID fra filnavn (tiltak/<id>.draft.json -> <id>)
          const match = file.path.match(/tiltak\/([^/]+)\.draft\.json$/);
          if (!match) continue;
          const id = match[1];

          await storage.deleteJson(file.path);
          discarded.push({ id, collection: "tiltak" });
          logger.info(`${actor.email} forkastet draft for tiltak ${id}`);
        } catch (error) {
          logger.error(`Feil ved sletting av tiltak-draft ${file.path}:`, error);
        }
      }

      // Finn og slett alle tilskudd-drafts
      const tilskuddDraftFiles = await storage.listFiles("tilskudd/*.draft.json");
      for (const file of tilskuddDraftFiles) {
        try {
          // Hent ID fra filnavn (tilskudd/<id>.draft.json -> <id>)
          const match = file.path.match(/tilskudd\/([^/]+)\.draft\.json$/);
          if (!match) continue;
          const id = match[1];

          await storage.deleteJson(file.path);
          discarded.push({ id, collection: "tilskudd" });
          logger.info(`${actor.email} forkastet draft for tilskudd ${id}`);
        } catch (error) {
          logger.error(`Feil ved sletting av tilskudd-draft ${file.path}:`, error);
        }
      }

      res.json({
        success: true,
        discarded,
        count: discarded.length,
        message: discarded.length > 0
          ? `${discarded.length} draft(s) forkastet`
          : "Ingen drafts å forkaste",
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
