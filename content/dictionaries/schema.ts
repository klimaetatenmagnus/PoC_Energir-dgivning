import { z } from 'zod';
import { BuildingTypeKeySchema, NonEmptyStringSchema, SlugSchema } from '../schema-helpers';

export const dictionarySchemaVersion = 1 as const;

export const BuildingTypeDictionaryEntrySchema = z
  .object({
    id: BuildingTypeKeySchema,
    label: NonEmptyStringSchema,
    description: z.string().trim().optional(),
    aliases: z.array(NonEmptyStringSchema).default([]),
    internalOnly: z.boolean().default(false)
  })
  .strict();

export const BenefitDictionaryEntrySchema = z
  .object({
    id: SlugSchema,
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    icon: z.string().trim().optional(),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([])
  })
  .strict();

export const SupportTagDictionaryEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: NonEmptyStringSchema,
    description: z.string().trim().optional(),
    synonyms: z.array(NonEmptyStringSchema).default([]),
    category: z.string().trim().optional()
  })
  .strict();

const GlossaryLinkSchema = z
  .object({
    label: NonEmptyStringSchema,
    url: z.string().url()
  })
  .strict();

export const GlossaryTermDictionaryEntrySchema = z
  .object({
    id: SlugSchema,
    term: NonEmptyStringSchema,
    definition: z.array(NonEmptyStringSchema).min(1),
    links: z.array(GlossaryLinkSchema).default([])
  })
  .strict();

export const ContentDictionarySchema = z
  .object({
    schemaVersion: z.literal(dictionarySchemaVersion),
    buildingTypes: z.array(BuildingTypeDictionaryEntrySchema),
    benefits: z.array(BenefitDictionaryEntrySchema),
    supportTags: z.array(SupportTagDictionaryEntrySchema),
    glossaryTerms: z.array(GlossaryTermDictionaryEntrySchema).default([])
  })
  .strict();

export type BuildingTypeDictionaryEntry = z.infer<typeof BuildingTypeDictionaryEntrySchema>;
export type BenefitDictionaryEntry = z.infer<typeof BenefitDictionaryEntrySchema>;
export type SupportTagDictionaryEntry = z.infer<typeof SupportTagDictionaryEntrySchema>;
export type GlossaryTermDictionaryEntry = z.infer<typeof GlossaryTermDictionaryEntrySchema>;
export type ContentDictionary = z.infer<typeof ContentDictionarySchema>;
