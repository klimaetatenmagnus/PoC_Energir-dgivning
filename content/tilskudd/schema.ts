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

export const tilskuddSchemaVersion = 1 as const;

const LinkSchema = z
  .object({
    id: SlugSchema.optional(),
    label: NonEmptyStringSchema,
    url: z.string().url(),
    description: z.string().trim().optional(),
    audiences: AudienceFilterSchema
  })
  .strict();

const ContactSchema = z
  .object({
    id: SlugSchema.optional(),
    name: NonEmptyStringSchema.optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().optional(),
    url: z.string().url().optional(),
    audiences: AudienceFilterSchema
  })
  .strict();

const AmountBaseSchema = z.object({
  audiences: AudienceFilterSchema
});

const FixedAmountSchema = AmountBaseSchema.extend({
  kind: z.literal('fixed'),
  amount: z.number().nonnegative(),
  currency: z.string().trim().default('NOK'),
  description: z.string().trim().optional(),
  perUnit: z.string().trim().optional()
}).superRefine((value, ctx) => {
  if (value.amount === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be greater than zero' });
  }
});

const PercentageAmountSchema = AmountBaseSchema.extend({
  kind: z.literal('percentage'),
  rate: z.number().min(0).max(100),
  description: z.string().trim().optional()
});

const RangeAmountSchema = AmountBaseSchema.extend({
  kind: z.literal('range'),
  minAmount: z.number().nonnegative(),
  maxAmount: z.number().positive(),
  currency: z.string().trim().default('NOK'),
  description: z.string().trim().optional()
}).refine((value) => value.maxAmount >= value.minAmount, {
  message: 'maxAmount must be greater than or equal to minAmount'
});

const CustomAmountSchema = AmountBaseSchema.extend({
  kind: z.literal('custom'),
  description: NonEmptyStringSchema
});

const AmountSchema = z.discriminatedUnion('kind', [
  FixedAmountSchema,
  PercentageAmountSchema,
  RangeAmountSchema,
  CustomAmountSchema
]);

const EligibilityItemSchema = z
  .object({
    id: SlugSchema.optional(),
    title: NonEmptyStringSchema,
    description: ParagraphArraySchema.optional(),
    documents: z.array(LinkSchema).default([]),
    audiences: AudienceFilterSchema
  })
  .strict();

const RequirementSchema = z
  .object({
    id: SlugSchema.optional(),
    title: NonEmptyStringSchema,
    description: ParagraphArraySchema.optional(),
    mandatory: z.boolean().default(true),
    documents: z.array(LinkSchema).default([]),
    audiences: AudienceFilterSchema
  })
  .strict();

const ApplicationProcessSchema = z
  .object({
    url: z.string().url(),
    guidanceUrl: z.string().url().optional(),
    deadline: z.string().datetime().optional(),
    rolling: z.boolean().default(true),
    processingTimeWeeks: z.number().positive().optional(),
    documents: z.array(LinkSchema).default([]),
    audiences: AudienceFilterSchema
  })
  .strict();

const ProviderSchema = z
  .object({
    name: NonEmptyStringSchema,
    organizationNumber: z.string().trim().optional(),
    url: z.string().url().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().trim().optional()
  })
  .strict();

export const TilskuddContentSchema = z
  .object({
    schemaVersion: z.literal(tilskuddSchemaVersion).default(tilskuddSchemaVersion),
    id: SlugSchema,
    title: NonEmptyStringSchema,
    summary: z.string().trim().max(280).optional(),
    description: ParagraphArraySchema,
    category: z.string().trim().optional(),
    provider: ProviderSchema,
    funding: z.array(AmountSchema).min(1),
    eligibility: z.array(EligibilityItemSchema).min(1),
    requirements: z.array(RequirementSchema).default([]),
    buildingTypes: z.array(BuildingTypeKeySchema).nonempty(),
    appliesToTiltak: z.array(SlugSchema).default([]),
    regions: z.array(z.string().trim().min(1)).default(['national']),
    audiences: z.array(ContentAudienceSchema).min(1).default(['standard']),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).default([]),
    contacts: z.array(ContactSchema).default([]),
    application: ApplicationProcessSchema,
    links: z.array(LinkSchema).default([]),
    metadata: MetadataSchema
  })
  .strict();

export type TilskuddLink = z.infer<typeof LinkSchema>;
export type TilskuddContact = z.infer<typeof ContactSchema>;
export type TilskuddAmount = z.infer<typeof AmountSchema>;
export type TilskuddEligibility = z.infer<typeof EligibilityItemSchema>;
export type TilskuddRequirement = z.infer<typeof RequirementSchema>;
export type TilskuddApplication = z.infer<typeof ApplicationProcessSchema>;
export type TilskuddContent = z.infer<typeof TilskuddContentSchema>;
