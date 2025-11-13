import { z } from 'zod';
import {
  AudienceFilterSchema,
  BuildingTypeKeySchema,
  ContentAudienceSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  ParagraphArraySchema,
  SlugSchema
} from '../schema-helpers';

export const tiltakSchemaVersion = 1 as const;

const BuildingParagraphsSchema = z
  .record(BuildingTypeKeySchema, ParagraphArraySchema)
  .superRefine((value, ctx) => {
    if (!Object.prototype.hasOwnProperty.call(value, 'default')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a 'default' entry for fallback building text"
      });
    }
  });

const MediaAssetSchema = z
  .object({
    src: NonEmptyStringSchema,
    alt: NonEmptyStringSchema,
    caption: z.string().trim().optional(),
    credit: z.string().trim().optional()
  })
  .strict();

const LinkSchema = z
  .object({
    id: SlugSchema.optional(),
    label: NonEmptyStringSchema,
    url: z.string().url(),
    description: z.string().trim().max(280).optional(),
    audiences: AudienceFilterSchema
  })
  .strict();

const CallToActionSchema = LinkSchema.extend({
  style: z.enum(['primary', 'secondary', 'link']).default('primary')
});

const BenefitSchema = z
  .object({
    id: SlugSchema.optional(),
    title: NonEmptyStringSchema,
    description: NonEmptyStringSchema,
    icon: z.string().trim().optional(),
    audiences: AudienceFilterSchema
  })
  .strict();

const ContentBlockSchema = z
  .object({
    id: SlugSchema.optional(),
    title: NonEmptyStringSchema.optional(),
    body: ParagraphArraySchema,
    style: z.enum(['default', 'highlight', 'quote', 'checklist']).default('default'),
    icon: z.string().trim().optional(),
    audiences: AudienceFilterSchema
  })
  .strict();

const SectionSchema = z
  .object({
    id: SlugSchema,
    title: NonEmptyStringSchema,
    description: z.string().trim().optional(),
    blocks: z.array(ContentBlockSchema).min(1),
    audiences: AudienceFilterSchema
  })
  .strict();

const PartialBuildingParagraphsSchema = z.record(BuildingTypeKeySchema, ParagraphArraySchema);

const TabSchema = z
  .object({
    id: SlugSchema,
    title: NonEmptyStringSchema,
    summary: z.string().trim().optional(),
    body: ParagraphArraySchema,
    buildingTypeBody: PartialBuildingParagraphsSchema.optional(),
    media: MediaAssetSchema.optional(),
    readMore: z.array(LinkSchema).default([]),
    audiences: AudienceFilterSchema
  })
  .strict();

const TabsSectionSchema = z
  .object({
    type: z.literal('tabs'),
    title: NonEmptyStringSchema.optional(),
    description: z.string().trim().optional(),
    tabs: z.array(TabSchema).min(2),
    audiences: AudienceFilterSchema
  })
  .strict();

const GlossaryEntrySchema = z
  .object({
    term: NonEmptyStringSchema,
    definition: ParagraphArraySchema,
    links: z.array(LinkSchema).default([]),
    audiences: AudienceFilterSchema
  })
  .strict();

const AccordionItemSchema = z
  .object({
    id: SlugSchema,
    title: NonEmptyStringSchema,
    body: ParagraphArraySchema,
    links: z.array(LinkSchema).default([]),
    glossary: z.array(GlossaryEntrySchema).default([]),
    audiences: AudienceFilterSchema
  })
  .strict();

const DataPointSchema = z
  .object({
    label: NonEmptyStringSchema,
    value: NonEmptyStringSchema,
    unit: z.string().trim().optional(),
    helpText: z.string().trim().optional(),
    audiences: AudienceFilterSchema
  })
  .strict();

const StatBlockSchema = z
  .object({
    id: SlugSchema,
    title: NonEmptyStringSchema,
    description: ParagraphArraySchema.optional(),
    dataPoints: z.array(DataPointSchema).min(1),
    audiences: AudienceFilterSchema
  })
  .strict();

const VariantOverrideSchema = z
  .object({
    audience: ContentAudienceSchema,
    title: NonEmptyStringSchema.optional(),
    introParagraphs: ParagraphArraySchema.optional(),
    buildingTypeParagraphs: PartialBuildingParagraphsSchema.optional(),
    benefits: z.array(BenefitSchema).optional(),
    readMore: z.array(LinkSchema).optional(),
    callsToAction: z.array(CallToActionSchema).optional(),
    customSections: z.array(SectionSchema).optional(),
    tabs: z.array(TabsSectionSchema).optional(),
    accordion: z.array(AccordionItemSchema).optional(),
    stats: z.array(StatBlockSchema).optional(),
    grants: z.array(SlugSchema).optional(),
    supportTags: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional()
  })
  .strict();

export const TiltakContentSchema = z
  .object({
    schemaVersion: z.literal(tiltakSchemaVersion).default(tiltakSchemaVersion),
    id: SlugSchema,
    title: NonEmptyStringSchema,
    summary: z.string().trim().max(280).optional(),
    introParagraphs: ParagraphArraySchema,
    buildingTypeParagraphs: BuildingParagraphsSchema,
    benefits: z.array(BenefitSchema).default([]),
    readMore: z.array(LinkSchema).default([]),
    callsToAction: z.array(CallToActionSchema).default([]),
    customSections: z.array(SectionSchema).default([]),
    tabs: z.array(TabsSectionSchema).default([]),
    accordion: z.array(AccordionItemSchema).default([]),
    stats: z.array(StatBlockSchema).default([]),
    media: MediaAssetSchema.optional(),
    grants: z.array(SlugSchema).default([]),
    relatedTiltak: z.array(SlugSchema).default([]),
    supportTags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
    audiences: z.array(ContentAudienceSchema).min(1).default(['standard']),
    metadata: MetadataSchema,
    variants: z.array(VariantOverrideSchema).default([])
  })
  .strict();

export type TiltakLink = z.infer<typeof LinkSchema>;
export type TiltakBenefit = z.infer<typeof BenefitSchema>;
export type TiltakCallToAction = z.infer<typeof CallToActionSchema>;
export type TiltakSection = z.infer<typeof SectionSchema>;
export type TiltakTabsSection = z.infer<typeof TabsSectionSchema>;
export type TiltakAccordionItem = z.infer<typeof AccordionItemSchema>;
export type TiltakGlossaryEntry = z.infer<typeof GlossaryEntrySchema>;
export type TiltakStatBlock = z.infer<typeof StatBlockSchema>;
export type TiltakVariantOverride = z.infer<typeof VariantOverrideSchema>;
export type TiltakContent = z.infer<typeof TiltakContentSchema>;
export type { BuildingTypeKey } from '../schema-helpers';
