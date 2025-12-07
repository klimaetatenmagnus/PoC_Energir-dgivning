import { Router } from "express";
import { z } from "zod";
import {
  ContentDictionarySchema,
  type ContentDictionary,
} from "../../content/dictionaries/schema";
import {
  TiltakContentSchema,
  type TiltakBenefit,
  type TiltakContent,
} from "../../content/tiltak/schema";
import {
  TilskuddContentSchema,
  type TilskuddContent,
} from "../../content/tilskudd/schema";
import { SlugSchema } from "../../content/schema-helpers";
import { resolveUserContext } from "./auth.js";
import type { AdminApiConfig } from "./config.js";
import { ContentStorage } from "./contentStorage.js";
import { HttpError } from "./httpError.js";

const TiltakBenefitRefSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/);

const BenefitRefsPayloadSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
  benefitRefs: z.array(TiltakBenefitRefSchema).max(4),
  changeSummary: z
    .string()
    .trim()
    .min(5, { message: "Bruk en kort oppsummering av endringen" })
    .max(280)
    .optional(),
});

const UpdateTiltakPayloadSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
  tiltak: TiltakContentSchema,
  changeSummary: z
    .string()
    .trim()
    .min(5, { message: "Bruk en kort oppsummering av endringen" })
    .max(280)
    .optional(),
});

const CreateTiltakPayloadSchema = z.object({
  tiltak: TiltakContentSchema,
  changeSummary: z
    .string()
    .trim()
    .min(5, { message: "Bruk en kort oppsummering" })
    .max(280)
    .optional(),
});

const UpdateTilskuddPayloadSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
  tilskudd: TilskuddContentSchema,
  changeSummary: z
    .string()
    .trim()
    .min(5, { message: "Bruk en kort oppsummering av endringen" })
    .max(280)
    .optional(),
});

const CreateTilskuddPayloadSchema = z.object({
  tilskudd: TilskuddContentSchema,
  changeSummary: z
    .string()
    .trim()
    .min(5, { message: "Bruk en kort oppsummering" })
    .max(280)
    .optional(),
});

/**
 * Hjelpefunksjoner for draft-filer
 */
function buildTiltakPath(id: string): string {
  return `tiltak/${id}.json`;
}

function buildTiltakDraftPath(id: string): string {
  return `tiltak/${id}.draft.json`;
}

function buildTilskuddPath(id: string): string {
  return `tilskudd/${id}.json`;
}

function buildTilskuddDraftPath(id: string): string {
  return `tilskudd/${id}.draft.json`;
}

export function createContentRouter(
  _config: AdminApiConfig,
  storage: ContentStorage
) {
  const router = Router();

  router.get("/content/tiltak/:id/metadata", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const path = buildTiltakPath(tiltakId);
      const { data, generation, etag } =
        await storage.readJson<TiltakContent>(path);
      const parsed = TiltakContentSchema.parse(data);
      res.json({
        id: parsed.id,
        path,
        generation,
        etag,
        metadata: parsed.metadata,
        benefitRefs: parsed.benefitRefs ?? [],
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/content/tiltak/:id/benefit-refs", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const body = BenefitRefsPayloadSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const path = buildTiltakPath(tiltakId);

      const [{ dictionary }, { data: content }] = await Promise.all([
        loadDictionary(storage),
        storage.readJson<TiltakContent>(path),
      ]);

      const parsedContent = TiltakContentSchema.parse(content);
      const refs = dedupeRefs(body.benefitRefs);
      validateBenefitRefs(refs, dictionary);

      const now = new Date().toISOString();
      const summary =
        body.changeSummary?.trim() ||
        `Oppdatert fordeler (${refs.join(", ") || "ingen"}) via admin-UI`;

      const updatedContent: TiltakContent = {
        ...parsedContent,
        benefitRefs: refs,
        benefits: buildBenefitsFromRefs(refs, dictionary),
        metadata: {
          ...parsedContent.metadata,
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: summary.slice(0, 500),
        },
      };

      const result = await storage.writeJson(path, updatedContent, {
        expectedGeneration: body.generation,
      });

      console.warn(
        `[admin-api] ${actor.email} oppdaterte benefitRefs for tiltak ${tiltakId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        id: updatedContent.id,
        path,
        benefitRefs: updatedContent.benefitRefs,
        metadata: updatedContent.metadata,
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  // Full tiltak-oppdatering - skriver til draft-fil
  router.put("/content/tiltak/:id", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const body = UpdateTiltakPayloadSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const draftPath = buildTiltakDraftPath(tiltakId);
      const publishedPath = buildTiltakPath(tiltakId);

      // Verifiser at ID matcher
      if (body.tiltak.id !== tiltakId) {
        throw new HttpError(400, `Tiltak-ID i URL (${tiltakId}) matcher ikke ID i body (${body.tiltak.id})`);
      }

      // Hent dictionary for å bygge benefits fra refs
      const { dictionary } = await loadDictionary(storage);

      // Valider benefitRefs hvis de finnes
      const refs = dedupeRefs(body.tiltak.benefitRefs ?? []);
      if (refs.length > 0) {
        validateBenefitRefs(refs, dictionary);
      }

      const now = new Date().toISOString();
      const summary =
        body.changeSummary?.trim() ||
        body.tiltak.metadata.changeSummary ||
        "Oppdatert via admin-UI";

      // Draft-innhold holder status som "draft" for å markere at det er en arbeidsversjon
      const updatedContent: TiltakContent = {
        ...body.tiltak,
        benefitRefs: refs,
        benefits: buildBenefitsFromRefs(refs, dictionary),
        metadata: {
          ...body.tiltak.metadata,
          status: "draft", // Alltid draft når vi lagrer til draft-fil
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: summary.slice(0, 500),
        },
      };

      // Sjekk om dette er første draft (ny fil) eller oppdatering av eksisterende draft
      const hasDraft = await storage.exists(draftPath);

      // Hvis det ikke finnes en draft fra før, sjekk at generation matcher publisert versjon
      // Hvis det allerede finnes en draft, bruk draft's generation for optimistisk låsing
      let writeOptions: { expectedGeneration?: string } = {};
      if (hasDraft) {
        // Vi har allerede en draft - bruk generation fra draft
        writeOptions = { expectedGeneration: body.generation };
      }
      // Hvis ingen draft fra før, skriv ny fil uten generation-sjekk
      // (første gang vi lager draft fra publisert versjon)

      const result = await storage.writeJson(draftPath, updatedContent, writeOptions);

      console.warn(
        `[admin-api] ${actor.email} lagret draft for tiltak ${tiltakId} (generation=${result.generation ?? "ukjent"})`
      );

      // Sjekk om publisert versjon finnes for å kunne gi hasDraft-info
      const hasPublished = await storage.exists(publishedPath);

      res.json({
        id: updatedContent.id,
        path: draftPath,
        tiltak: updatedContent,
        metadata: updatedContent.metadata,
        generation: result.generation,
        hasDraft: true,
        hasPublished,
        source: "draft",
      });
    } catch (error) {
      next(error);
    }
  });

  // Hent fullstendig tiltak-innhold (for editor)
  // Returnerer draft hvis den finnes, ellers publisert versjon
  router.get("/content/tiltak/:id", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const draftPath = buildTiltakDraftPath(tiltakId);
      const publishedPath = buildTiltakPath(tiltakId);

      // Sjekk om draft eksisterer
      const hasDraft = await storage.exists(draftPath);
      const pathToRead = hasDraft ? draftPath : publishedPath;

      const { data, generation, etag } =
        await storage.readJson<TiltakContent>(pathToRead);
      const parsed = TiltakContentSchema.parse(data);

      res.json({
        tiltak: parsed,
        generation,
        etag,
        hasDraft,
        source: hasDraft ? "draft" : "published",
      });
    } catch (error) {
      next(error);
    }
  });

  // Opprett nytt tiltak (lagres som draft)
  router.post("/content/tiltak", async (req, res, next) => {
    try {
      const body = CreateTiltakPayloadSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const tiltakId = body.tiltak.id;

      // Valider at ID er gyldig slug
      SlugSchema.parse(tiltakId);

      // Sjekk at tiltak med denne ID-en ikke allerede eksisterer
      const publishedPath = buildTiltakPath(tiltakId);
      const draftPath = buildTiltakDraftPath(tiltakId);

      const [publishedExists, draftExists] = await Promise.all([
        storage.exists(publishedPath),
        storage.exists(draftPath),
      ]);

      if (publishedExists || draftExists) {
        throw new HttpError(
          409,
          `Et tiltak med ID "${tiltakId}" eksisterer allerede`
        );
      }

      // Hent dictionary for å bygge benefits fra refs
      const { dictionary } = await loadDictionary(storage);
      const refs = dedupeRefs(body.tiltak.benefitRefs ?? []);
      if (refs.length > 0) {
        validateBenefitRefs(refs, dictionary);
      }

      const now = new Date().toISOString();
      const summary = body.changeSummary?.trim() || "Opprettet via admin-UI";

      // Opprett som draft (ikke publisert)
      const newTiltak: TiltakContent = {
        ...body.tiltak,
        benefitRefs: refs,
        benefits: buildBenefitsFromRefs(refs, dictionary),
        metadata: {
          ...body.tiltak.metadata,
          status: "draft",
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: summary.slice(0, 500),
        },
      };

      // Skriv til draft-fil
      const result = await storage.writeJson(draftPath, newTiltak);

      console.warn(
        `[admin-api] ${actor.email} opprettet nytt tiltak ${tiltakId}`
      );

      res.status(201).json({
        id: newTiltak.id,
        path: draftPath,
        tiltak: newTiltak,
        metadata: newTiltak.metadata,
        generation: result.generation,
        hasDraft: true,
        hasPublished: false,
        source: "draft",
      });
    } catch (error) {
      next(error);
    }
  });

  // Publiser draft til hovedfil
  router.post("/content/tiltak/:id/publish", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const actor = resolveUserContext(req);
      const draftPath = buildTiltakDraftPath(tiltakId);
      const publishedPath = buildTiltakPath(tiltakId);

      // Sjekk at draft eksisterer
      const hasDraft = await storage.exists(draftPath);
      if (!hasDraft) {
        throw new HttpError(
          404,
          `Ingen draft-versjon funnet for tiltak ${tiltakId}. Ingenting å publisere.`
        );
      }

      // Les draft-innholdet
      const { data: draftData } = await storage.readJson<TiltakContent>(draftPath);
      const parsed = TiltakContentSchema.parse(draftData);

      // Oppdater metadata for publisering
      const now = new Date().toISOString();
      const publishedContent: TiltakContent = {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          status: "published",
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: `Publisert av ${actor.email}`,
        },
      };

      // Skriv til hovedfilen (publisert versjon)
      const result = await storage.writeJson(publishedPath, publishedContent);

      // Slett draft-filen
      await storage.deleteJson(draftPath);

      console.warn(
        `[admin-api] ${actor.email} publiserte tiltak ${tiltakId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        id: publishedContent.id,
        path: publishedPath,
        tiltak: publishedContent,
        metadata: publishedContent.metadata,
        generation: result.generation,
        message: `Tiltak "${publishedContent.title}" er nå publisert`,
      });
    } catch (error) {
      next(error);
    }
  });

  // Forkast draft (slett draft-filen uten å publisere)
  router.delete("/content/tiltak/:id/draft", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const actor = resolveUserContext(req);
      const draftPath = buildTiltakDraftPath(tiltakId);

      // Sjekk at draft eksisterer
      const hasDraft = await storage.exists(draftPath);
      if (!hasDraft) {
        throw new HttpError(
          404,
          `Ingen draft-versjon funnet for tiltak ${tiltakId}`
        );
      }

      // Slett draft-filen
      await storage.deleteJson(draftPath);

      console.warn(
        `[admin-api] ${actor.email} forkastet draft for tiltak ${tiltakId}`
      );

      res.json({
        id: tiltakId,
        message: `Draft for tiltak ${tiltakId} er forkastet`,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===== TILSKUDD ENDPOINTS =====

  // Hent fullstendig tilskudd-innhold (for editor)
  // Returnerer draft hvis den finnes, ellers publisert versjon
  router.get("/content/tilskudd/:id", async (req, res, next) => {
    try {
      const tilskuddId = SlugSchema.parse(req.params.id?.trim());
      const draftPath = buildTilskuddDraftPath(tilskuddId);
      const publishedPath = buildTilskuddPath(tilskuddId);

      // Sjekk om draft eksisterer
      const hasDraft = await storage.exists(draftPath);
      const pathToRead = hasDraft ? draftPath : publishedPath;

      const { data, generation, etag } =
        await storage.readJson<TilskuddContent>(pathToRead);
      const parsed = TilskuddContentSchema.parse(data);

      res.json({
        tilskudd: parsed,
        generation,
        etag,
        hasDraft,
        source: hasDraft ? "draft" : "published",
      });
    } catch (error) {
      next(error);
    }
  });

  // Opprett nytt tilskudd (lagres som draft)
  router.post("/content/tilskudd", async (req, res, next) => {
    try {
      const body = CreateTilskuddPayloadSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const tilskuddId = body.tilskudd.id;

      // Valider at ID er gyldig slug
      SlugSchema.parse(tilskuddId);

      // Sjekk at tilskudd med denne ID-en ikke allerede eksisterer
      const publishedPath = buildTilskuddPath(tilskuddId);
      const draftPath = buildTilskuddDraftPath(tilskuddId);

      const [publishedExists, draftExists] = await Promise.all([
        storage.exists(publishedPath),
        storage.exists(draftPath),
      ]);

      if (publishedExists || draftExists) {
        throw new HttpError(
          409,
          `Et tilskudd med ID "${tilskuddId}" eksisterer allerede`
        );
      }

      const now = new Date().toISOString();
      const summary = body.changeSummary?.trim() || "Opprettet via admin-UI";

      // Opprett som draft (ikke publisert)
      const newTilskudd: TilskuddContent = {
        ...body.tilskudd,
        metadata: {
          ...body.tilskudd.metadata,
          status: "draft",
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: summary.slice(0, 500),
        },
      };

      // Skriv til draft-fil
      const result = await storage.writeJson(draftPath, newTilskudd);

      console.warn(
        `[admin-api] ${actor.email} opprettet nytt tilskudd ${tilskuddId}`
      );

      res.status(201).json({
        id: newTilskudd.id,
        path: draftPath,
        tilskudd: newTilskudd,
        metadata: newTilskudd.metadata,
        generation: result.generation,
        hasDraft: true,
        hasPublished: false,
        source: "draft",
      });
    } catch (error) {
      next(error);
    }
  });

  // Full tilskudd-oppdatering - skriver til draft-fil
  router.put("/content/tilskudd/:id", async (req, res, next) => {
    try {
      const tilskuddId = SlugSchema.parse(req.params.id?.trim());
      const body = UpdateTilskuddPayloadSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const draftPath = buildTilskuddDraftPath(tilskuddId);
      const publishedPath = buildTilskuddPath(tilskuddId);

      // Verifiser at ID matcher
      if (body.tilskudd.id !== tilskuddId) {
        throw new HttpError(400, `Tilskudd-ID i URL (${tilskuddId}) matcher ikke ID i body (${body.tilskudd.id})`);
      }

      const now = new Date().toISOString();
      const summary =
        body.changeSummary?.trim() ||
        body.tilskudd.metadata.changeSummary ||
        "Oppdatert via admin-UI";

      // Draft-innhold holder status som "draft" for å markere at det er en arbeidsversjon
      const updatedContent: TilskuddContent = {
        ...body.tilskudd,
        metadata: {
          ...body.tilskudd.metadata,
          status: "draft", // Alltid draft når vi lagrer til draft-fil
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: summary.slice(0, 500),
        },
      };

      // Sjekk om dette er første draft (ny fil) eller oppdatering av eksisterende draft
      const hasDraft = await storage.exists(draftPath);

      // Hvis det ikke finnes en draft fra før, sjekk at generation matcher publisert versjon
      // Hvis det allerede finnes en draft, bruk draft's generation for optimistisk låsing
      let writeOptions: { expectedGeneration?: string } = {};
      if (hasDraft) {
        // Vi har allerede en draft - bruk generation fra draft
        writeOptions = { expectedGeneration: body.generation };
      }
      // Hvis ingen draft fra før, skriv ny fil uten generation-sjekk
      // (første gang vi lager draft fra publisert versjon)

      const result = await storage.writeJson(draftPath, updatedContent, writeOptions);

      console.warn(
        `[admin-api] ${actor.email} lagret draft for tilskudd ${tilskuddId} (generation=${result.generation ?? "ukjent"})`
      );

      // Sjekk om publisert versjon finnes for å kunne gi hasDraft-info
      const hasPublished = await storage.exists(publishedPath);

      res.json({
        id: updatedContent.id,
        path: draftPath,
        tilskudd: updatedContent,
        metadata: updatedContent.metadata,
        generation: result.generation,
        hasDraft: true,
        hasPublished,
        source: "draft",
      });
    } catch (error) {
      next(error);
    }
  });

  // Publiser tilskudd draft til hovedfil
  router.post("/content/tilskudd/:id/publish", async (req, res, next) => {
    try {
      const tilskuddId = SlugSchema.parse(req.params.id?.trim());
      const actor = resolveUserContext(req);
      const draftPath = buildTilskuddDraftPath(tilskuddId);
      const publishedPath = buildTilskuddPath(tilskuddId);

      // Sjekk at draft eksisterer
      const hasDraft = await storage.exists(draftPath);
      if (!hasDraft) {
        throw new HttpError(
          404,
          `Ingen draft-versjon funnet for tilskudd ${tilskuddId}. Ingenting å publisere.`
        );
      }

      // Les draft-innholdet
      const { data: draftData } = await storage.readJson<TilskuddContent>(draftPath);
      const parsed = TilskuddContentSchema.parse(draftData);

      // Oppdater metadata for publisering
      const now = new Date().toISOString();
      const publishedContent: TilskuddContent = {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          status: "published",
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: `Publisert av ${actor.email}`,
        },
      };

      // Skriv til hovedfilen (publisert versjon)
      const result = await storage.writeJson(publishedPath, publishedContent);

      // Slett draft-filen
      await storage.deleteJson(draftPath);

      console.warn(
        `[admin-api] ${actor.email} publiserte tilskudd ${tilskuddId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        id: publishedContent.id,
        path: publishedPath,
        tilskudd: publishedContent,
        metadata: publishedContent.metadata,
        generation: result.generation,
        message: `Tilskudd "${publishedContent.title}" er nå publisert`,
      });
    } catch (error) {
      next(error);
    }
  });

  // Forkast tilskudd draft (slett draft-filen uten å publisere)
  router.delete("/content/tilskudd/:id/draft", async (req, res, next) => {
    try {
      const tilskuddId = SlugSchema.parse(req.params.id?.trim());
      const actor = resolveUserContext(req);
      const draftPath = buildTilskuddDraftPath(tilskuddId);

      // Sjekk at draft eksisterer
      const hasDraft = await storage.exists(draftPath);
      if (!hasDraft) {
        throw new HttpError(
          404,
          `Ingen draft-versjon funnet for tilskudd ${tilskuddId}`
        );
      }

      // Slett draft-filen
      await storage.deleteJson(draftPath);

      console.warn(
        `[admin-api] ${actor.email} forkastet draft for tilskudd ${tilskuddId}`
      );

      res.json({
        id: tilskuddId,
        message: `Draft for tilskudd ${tilskuddId} er forkastet`,
      });
    } catch (error) {
      next(error);
    }
  });

  // ===== SOFT DELETE ENDPOINTS =====
  // Sletting oppretter en draft med status "deleted".
  // Slettingen må publiseres via wizarden for å bli permanent.
  // Kan forkastes via "Forkast utkast"-knappen.

  // Myk sletting av tiltak (oppretter draft med status "deleted")
  router.delete("/content/tiltak/:id", async (req, res, next) => {
    try {
      const tiltakId = SlugSchema.parse(req.params.id?.trim());
      const actor = resolveUserContext(req);
      const draftPath = buildTiltakDraftPath(tiltakId);
      const publishedPath = buildTiltakPath(tiltakId);

      // Sjekk om tiltak eksisterer (enten draft eller publisert)
      const [hasDraft, hasPublished] = await Promise.all([
        storage.exists(draftPath),
        storage.exists(publishedPath),
      ]);

      if (!hasDraft && !hasPublished) {
        throw new HttpError(404, `Tiltak ${tiltakId} finnes ikke`);
      }

      // Les eksisterende innhold (prioriter draft hvis den finnes)
      const pathToRead = hasDraft ? draftPath : publishedPath;
      const { data } = await storage.readJson<TiltakContent>(pathToRead);
      const parsed = TiltakContentSchema.parse(data);

      // Marker som slettet - lagres som draft slik at det kan forkastes
      const now = new Date().toISOString();
      const deletedContent: TiltakContent = {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          status: "deleted",
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: `Markert for sletting av ${actor.email}`,
        },
      };

      // Skriv til DRAFT-fil (ikke publisert) - slettingen må publiseres via wizard
      const result = await storage.writeJson(draftPath, deletedContent);

      console.warn(
        `[admin-api] ${actor.email} markerte tiltak ${tiltakId} for sletting (draft)`
      );

      res.json({
        id: tiltakId,
        message: `Tiltak "${parsed.title}" er markert for sletting. Publiser via wizarden for å fullføre slettingen.`,
        hasDraft: true,
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  // Myk sletting av tilskudd (oppretter draft med status "deleted")
  router.delete("/content/tilskudd/:id", async (req, res, next) => {
    try {
      const tilskuddId = SlugSchema.parse(req.params.id?.trim());
      const actor = resolveUserContext(req);
      const draftPath = buildTilskuddDraftPath(tilskuddId);
      const publishedPath = buildTilskuddPath(tilskuddId);

      // Sjekk om tilskudd eksisterer (enten draft eller publisert)
      const [hasDraft, hasPublished] = await Promise.all([
        storage.exists(draftPath),
        storage.exists(publishedPath),
      ]);

      if (!hasDraft && !hasPublished) {
        throw new HttpError(404, `Tilskudd ${tilskuddId} finnes ikke`);
      }

      // Les eksisterende innhold (prioriter draft hvis den finnes)
      const pathToRead = hasDraft ? draftPath : publishedPath;
      const { data } = await storage.readJson<TilskuddContent>(pathToRead);
      const parsed = TilskuddContentSchema.parse(data);

      // Marker som slettet - lagres som draft slik at det kan forkastes
      const now = new Date().toISOString();
      const deletedContent: TilskuddContent = {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          status: "deleted",
          updatedAt: now,
          updatedBy: actor.email,
          changeSummary: `Markert for sletting av ${actor.email}`,
        },
      };

      // Skriv til DRAFT-fil (ikke publisert) - slettingen må publiseres via wizard
      const result = await storage.writeJson(draftPath, deletedContent);

      console.warn(
        `[admin-api] ${actor.email} markerte tilskudd ${tilskuddId} for sletting (draft)`
      );

      res.json({
        id: tilskuddId,
        message: `Tilskudd "${parsed.title}" er markert for sletting. Publiser via wizarden for å fullføre slettingen.`,
        hasDraft: true,
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function loadDictionary(storage: ContentStorage): Promise<{
  dictionary: ContentDictionary;
  generation: string | null;
}> {
  const { data, generation } =
    await storage.readJson<ContentDictionary>("dictionaries/index.json");
  const dictionary = ContentDictionarySchema.parse(data);
  return { dictionary, generation };
}

function dedupeRefs(refs: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const ref of refs) {
    if (!ref || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    result.push(ref);
  }

  return result;
}

function validateBenefitRefs(refs: string[], dictionary: ContentDictionary) {
  const validIds = new Set(dictionary.benefits.map((entry) => entry.id));
  const missing = refs.filter((ref) => !validIds.has(ref));
  if (missing.length > 0) {
    throw new HttpError(
      400,
      `Følgende benefitRefs finnes ikke i dictionaryen: ${missing.join(", ")}`
    );
  }
}

function buildBenefitsFromRefs(
  refs: string[],
  dictionary: ContentDictionary
): TiltakBenefit[] {
  const lookup = new Map(
    dictionary.benefits.map((entry) => [
      entry.id,
      {
        id: entry.id,
        title: entry.title,
        description: entry.description,
        icon: entry.icon,
      } satisfies TiltakBenefit,
    ])
  );

  const benefits: TiltakBenefit[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref)) {
      continue;
    }
    const entry = lookup.get(ref);
    if (!entry) {
      continue;
    }
    seen.add(ref);
    benefits.push(entry);
  }

  return benefits;
}
