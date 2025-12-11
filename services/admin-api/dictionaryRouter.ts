import { Router } from "express";
import { z } from "zod";
import {
  BenefitDictionaryEntrySchema,
  ContentDictionarySchema,
  dictionarySchemaVersion,
  GlossaryTermDictionaryEntrySchema,
  type BenefitDictionaryEntry,
  type ContentDictionary,
  type GlossaryTermDictionaryEntry,
} from "../../content/dictionaries/schema";
import { resolveUserContext } from "./auth.js";
import { ContentStorage } from "./contentStorage.js";
import { HttpError } from "./httpError.js";
import { createLogger } from "../shared/logger.js";

const logger = createLogger({ prefix: 'admin-api' });

const DICTIONARY_PATH = "dictionaries/index.json";

const BenefitMutationSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
  benefit: BenefitDictionaryEntrySchema,
});

const BenefitDeleteSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
});

const GlossaryTermMutationSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
  glossaryTerm: GlossaryTermDictionaryEntrySchema,
});

const GlossaryTermDeleteSchema = z.object({
  generation: z.string().min(1, { message: "Generation må oppgis" }),
});

export function createDictionaryRouter(storage: ContentStorage) {
  const router = Router();

  router.get("/dictionary", async (_req, res, next) => {
    try {
      const { dictionary, generation, etag } = await loadDictionary(storage);
      res.json({
        dictionary,
        generation,
        etag,
        schemaVersion: dictionary.schemaVersion,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/dictionary/benefits", async (req, res, next) => {
    try {
      const body = BenefitMutationSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const { dictionary } = await loadDictionary(storage);

      if (dictionary.benefits.some((entry) => entry.id === body.benefit.id)) {
        throw new HttpError(
          409,
          `Fordelen ${body.benefit.id} finnes allerede i dictionaryen`
        );
      }

      const updatedDictionary: ContentDictionary = {
        ...dictionary,
        schemaVersion: dictionarySchemaVersion,
        benefits: [
          ...dictionary.benefits,
          normaliseBenefitEntry(body.benefit),
        ],
      };

      const result = await storage.writeJson(DICTIONARY_PATH, updatedDictionary, {
        expectedGeneration: body.generation,
      });

      logger.info(
        `${actor.email} opprettet fordel ${body.benefit.id} (generation=${result.generation ?? "ukjent"})`
      );

      res.status(201).json({
        benefit: normaliseBenefitEntry(body.benefit),
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/dictionary/benefits/:id", async (req, res, next) => {
    try {
      const body = BenefitMutationSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const benefitId = req.params.id?.trim();
      if (!benefitId) {
        throw new HttpError(400, "Mangler benefit-id i path");
      }
      if (body.benefit.id !== benefitId) {
        throw new HttpError(
          400,
          "ID i body må matche ID i path ved oppdatering"
        );
      }

      const { dictionary } = await loadDictionary(storage);
      const index = dictionary.benefits.findIndex(
        (entry) => entry.id === benefitId
      );
      if (index === -1) {
        throw new HttpError(
          404,
          `Fant ikke fordel med id ${benefitId} i dictionaryen`
        );
      }

      const updatedBenefits = [...dictionary.benefits];
      updatedBenefits[index] = normaliseBenefitEntry(body.benefit);

      const updatedDictionary: ContentDictionary = {
        ...dictionary,
        schemaVersion: dictionarySchemaVersion,
        benefits: updatedBenefits,
      };

      const result = await storage.writeJson(DICTIONARY_PATH, updatedDictionary, {
        expectedGeneration: body.generation,
      });

      logger.info(
        `${actor.email} oppdaterte fordel ${benefitId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        benefit: updatedBenefits[index],
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/dictionary/benefits/:id", async (req, res, next) => {
    try {
      const body = BenefitDeleteSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const benefitId = req.params.id?.trim();
      if (!benefitId) {
        throw new HttpError(400, "Mangler benefit-id i path");
      }

      const { dictionary } = await loadDictionary(storage);
      const index = dictionary.benefits.findIndex(
        (entry) => entry.id === benefitId
      );
      if (index === -1) {
        throw new HttpError(
          404,
          `Fant ikke fordel med id ${benefitId} i dictionaryen`
        );
      }

      const updatedBenefits = dictionary.benefits.filter(
        (entry) => entry.id !== benefitId
      );
      const updatedDictionary: ContentDictionary = {
        ...dictionary,
        schemaVersion: dictionarySchemaVersion,
        benefits: updatedBenefits,
      };

      const result = await storage.writeJson(DICTIONARY_PATH, updatedDictionary, {
        expectedGeneration: body.generation,
      });

      logger.info(
        `${actor.email} slettet fordel ${benefitId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        generation: result.generation,
        deletedId: benefitId,
      });
    } catch (error) {
      next(error);
    }
  });

  // --- Glossary terms CRUD ---

  router.post("/dictionary/glossary-terms", async (req, res, next) => {
    try {
      const body = GlossaryTermMutationSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const { dictionary } = await loadDictionary(storage);

      const glossaryTerms = dictionary.glossaryTerms ?? [];
      if (glossaryTerms.some((entry) => entry.id === body.glossaryTerm.id)) {
        throw new HttpError(
          409,
          `Begrepet ${body.glossaryTerm.id} finnes allerede i ordlisten`
        );
      }

      const updatedDictionary: ContentDictionary = {
        ...dictionary,
        schemaVersion: dictionarySchemaVersion,
        glossaryTerms: [
          ...glossaryTerms,
          normaliseGlossaryTermEntry(body.glossaryTerm),
        ],
      };

      const result = await storage.writeJson(DICTIONARY_PATH, updatedDictionary, {
        expectedGeneration: body.generation,
      });

      logger.info(
        `${actor.email} opprettet ordlistebegrep ${body.glossaryTerm.id} (generation=${result.generation ?? "ukjent"})`
      );

      res.status(201).json({
        glossaryTerm: normaliseGlossaryTermEntry(body.glossaryTerm),
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/dictionary/glossary-terms/:id", async (req, res, next) => {
    try {
      const body = GlossaryTermMutationSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const termId = req.params.id?.trim();
      if (!termId) {
        throw new HttpError(400, "Mangler term-id i path");
      }
      if (body.glossaryTerm.id !== termId) {
        throw new HttpError(
          400,
          "ID i body må matche ID i path ved oppdatering"
        );
      }

      const { dictionary } = await loadDictionary(storage);
      const glossaryTerms = dictionary.glossaryTerms ?? [];
      const index = glossaryTerms.findIndex((entry) => entry.id === termId);
      if (index === -1) {
        throw new HttpError(
          404,
          `Fant ikke begrep med id ${termId} i ordlisten`
        );
      }

      const updatedGlossaryTerms = [...glossaryTerms];
      updatedGlossaryTerms[index] = normaliseGlossaryTermEntry(body.glossaryTerm);

      const updatedDictionary: ContentDictionary = {
        ...dictionary,
        schemaVersion: dictionarySchemaVersion,
        glossaryTerms: updatedGlossaryTerms,
      };

      const result = await storage.writeJson(DICTIONARY_PATH, updatedDictionary, {
        expectedGeneration: body.generation,
      });

      logger.info(
        `${actor.email} oppdaterte ordlistebegrep ${termId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        glossaryTerm: updatedGlossaryTerms[index],
        generation: result.generation,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/dictionary/glossary-terms/:id", async (req, res, next) => {
    try {
      const body = GlossaryTermDeleteSchema.parse(req.body ?? {});
      const actor = resolveUserContext(req);
      const termId = req.params.id?.trim();
      if (!termId) {
        throw new HttpError(400, "Mangler term-id i path");
      }

      const { dictionary } = await loadDictionary(storage);
      const glossaryTerms = dictionary.glossaryTerms ?? [];
      const index = glossaryTerms.findIndex((entry) => entry.id === termId);
      if (index === -1) {
        throw new HttpError(
          404,
          `Fant ikke begrep med id ${termId} i ordlisten`
        );
      }

      const updatedGlossaryTerms = glossaryTerms.filter(
        (entry) => entry.id !== termId
      );
      const updatedDictionary: ContentDictionary = {
        ...dictionary,
        schemaVersion: dictionarySchemaVersion,
        glossaryTerms: updatedGlossaryTerms,
      };

      const result = await storage.writeJson(DICTIONARY_PATH, updatedDictionary, {
        expectedGeneration: body.generation,
      });

      logger.info(
        `${actor.email} slettet ordlistebegrep ${termId} (generation=${result.generation ?? "ukjent"})`
      );

      res.json({
        generation: result.generation,
        deletedId: termId,
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
  etag: string | null;
}> {
  const { data, generation, etag } =
    await storage.readJson<ContentDictionary>(DICTIONARY_PATH);
  const dictionary = ContentDictionarySchema.parse(data);
  return { dictionary, generation, etag };
}

function normaliseBenefitEntry(
  entry: BenefitDictionaryEntry
): BenefitDictionaryEntry {
  const tags = Array.from(
    new Set(
      (entry.tags ?? [])
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );

  return {
    ...entry,
    tags,
  };
}

function normaliseGlossaryTermEntry(
  entry: GlossaryTermDictionaryEntry
): GlossaryTermDictionaryEntry {
  return {
    id: entry.id.trim(),
    term: entry.term.trim(),
    definition: entry.definition
      .map((p) => p.trim())
      .filter((p) => p.length > 0),
    links: (entry.links ?? []).map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
    })),
  };
}
