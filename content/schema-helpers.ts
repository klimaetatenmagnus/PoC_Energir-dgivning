import { z } from 'zod';

export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SlugSchema = z
  .string()
  .regex(slugRegex, { message: 'Use lowercase letters, numbers, and hyphen only' });

export const NonEmptyStringSchema = z.string().trim().min(1, { message: 'Value cannot be empty' });

export const BuildingTypeKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9_-]+$/, { message: 'Use lowercase letters, numbers, dash or underscore' });

export const ParagraphArraySchema = z.array(NonEmptyStringSchema).min(1);

export const ContentStatusSchema = z.enum(['draft', 'published', 'archived']);

export const ContentAudienceSchema = z.enum(['standard', 'gulliste']);

export const AudienceFilterSchema = z.array(ContentAudienceSchema).nonempty().optional();

export const MetadataSchema = z
  .object({
    status: ContentStatusSchema,
    updatedBy: NonEmptyStringSchema,
    updatedAt: z.string().datetime(),
    createdBy: NonEmptyStringSchema.optional(),
    createdAt: z.string().datetime().optional(),
    changeSummary: z.string().trim().max(500).optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
    reviewStatus: z.enum(['not-started', 'in-review', 'approved']).optional(),
    source: NonEmptyStringSchema.optional(),
    notes: z.string().trim().max(500).optional()
  })
  .strict();

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type ContentAudience = z.infer<typeof ContentAudienceSchema>;
export type ContentMetadata = z.infer<typeof MetadataSchema>;
export type BuildingTypeKey = z.infer<typeof BuildingTypeKeySchema>;
