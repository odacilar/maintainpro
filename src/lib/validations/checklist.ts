import { z } from "zod";
import {
  ChecklistPeriod,
  ChecklistItemType,
  ActionStatus,
  ActionPriority,
  Role,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Checklist item sub-schema (used in template create/update)
// ---------------------------------------------------------------------------

export const checklistItemSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.nativeEnum(ChecklistItemType),
  referenceValue: z.string().max(500).optional(),
  photoRequired: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Template schemas
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  machineId: z.string().cuid(),
  name: z.string().min(1).max(200),
  period: z.nativeEnum(ChecklistPeriod),
  assignedRoles: z.array(z.nativeEnum(Role)).min(1),
  items: z.array(checklistItemSchema).min(1),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  period: z.nativeEnum(ChecklistPeriod).optional(),
  isActive: z.boolean().optional(),
  assignedRoles: z.array(z.nativeEnum(Role)).min(1).optional(),
  // If provided, items array is a full replacement
  items: z.array(checklistItemSchema).min(1).optional(),
});

// ---------------------------------------------------------------------------
// Record create schema
// ---------------------------------------------------------------------------

export const createRecordSchema = z.object({
  templateId: z.string().cuid(),
  scheduledFor: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Checklist submission schema
// ---------------------------------------------------------------------------

export const itemResponseSchema = z.object({
  itemId: z.string().cuid(),
  valueBool: z.boolean().optional(),
  valueNumber: z.number().optional(),
  valueText: z.string().max(2000).optional(),
  isAbnormal: z.boolean(),
  note: z.string().max(2000).optional(),
});

export const submitChecklistSchema = z.object({
  responses: z.array(itemResponseSchema).min(1),
});

// ---------------------------------------------------------------------------
// Action transition schema
// ---------------------------------------------------------------------------

export const transitionActionSchema = z.object({
  status: z.nativeEnum(ActionStatus),
  resolutionNotes: z.string().max(5000).optional(),
  assigneeId: z.string().cuid().optional(),
  targetDate: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Action update schema (assign, set target date, change priority)
// ---------------------------------------------------------------------------

export const updateActionSchema = z.object({
  assigneeId: z.string().cuid().nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
  priority: z.nativeEnum(ActionPriority).optional(),
  description: z.string().min(1).max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type SubmitChecklistInput = z.infer<typeof submitChecklistSchema>;
export type ItemResponseInput = z.infer<typeof itemResponseSchema>;
export type TransitionActionInput = z.infer<typeof transitionActionSchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;
