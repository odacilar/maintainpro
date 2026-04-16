import { z } from "zod";
import { WorkOrderStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Frequency enum — convenience layer mapped to intervalDays in the service
// ---------------------------------------------------------------------------

export const PmFrequency = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  BIWEEKLY: "BIWEEKLY",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  BIANNUAL: "BIANNUAL",
  ANNUAL: "ANNUAL",
} as const;
export type PmFrequency = (typeof PmFrequency)[keyof typeof PmFrequency];

export const FREQUENCY_INTERVAL_DAYS: Record<PmFrequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  QUARTERLY: 90,
  BIANNUAL: 180,
  ANNUAL: 365,
};

export const PmPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type PmPriority = (typeof PmPriority)[keyof typeof PmPriority];

// ---------------------------------------------------------------------------
// PM Plan schemas
// ---------------------------------------------------------------------------

export const createPmPlanSchema = z.object({
  machineId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  frequency: z.nativeEnum(PmFrequency),
  priority: z.nativeEnum(PmPriority),
  estimatedMinutes: z.number().int().positive().optional(),
  assigneeId: z.string().cuid().optional(),
  instructions: z.string().max(5000).optional(),
  isActive: z.boolean().default(true),
});

export const updatePmPlanSchema = createPmPlanSchema.partial();

// ---------------------------------------------------------------------------
// Work Order schemas
// ---------------------------------------------------------------------------

export const createWorkOrderSchema = z.object({
  pmPlanId: z.string().cuid().optional(),
  machineId: z.string().cuid(),
  scheduledDate: z.string().datetime(),
  assigneeId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateWorkOrderSchema = z.object({
  status: z.nativeEnum(WorkOrderStatus).optional(),
  notes: z.string().max(2000).optional(),
  actualDurationMinutes: z.number().int().positive().optional(),
  assigneeId: z.string().cuid().optional(),
});

export const transitionWorkOrderSchema = z.object({
  status: z.nativeEnum(WorkOrderStatus),
  notes: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type CreatePmPlanInput = z.infer<typeof createPmPlanSchema>;
export type UpdatePmPlanInput = z.infer<typeof updatePmPlanSchema>;
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export type TransitionWorkOrderInput = z.infer<typeof transitionWorkOrderSchema>;
