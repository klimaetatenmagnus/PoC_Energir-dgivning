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

  return router;
}

function buildTiltakPath(id: string): string {
  return `tiltak/${id}.json`;
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
