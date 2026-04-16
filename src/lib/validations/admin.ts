import { z } from "zod";
import { SubscriptionPlan } from "@prisma/client";

// ---------------------------------------------------------------------------
// Factory schemas
// ---------------------------------------------------------------------------

export const createFactorySchema = z.object({
  name: z.string().min(1).max(200),
  /** URL-safe slug: lowercase letters, digits, hyphens only */
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug yalnızca küçük harf, rakam ve tire içerebilir.",
    }),
  city: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  plan: z.nativeEnum(SubscriptionPlan),
});

export const updateFactorySchema = createFactorySchema.partial();

// ---------------------------------------------------------------------------
// Subscription schema
// ---------------------------------------------------------------------------

export const updateSubscriptionSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  maxUsers: z.number().int().positive(),
  maxMachines: z.number().int().positive(),
  maxStorageGb: z.number().int().positive(),
  isActive: z.boolean(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateFactoryInput = z.infer<typeof createFactorySchema>;
export type UpdateFactoryInput = z.infer<typeof updateFactorySchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
