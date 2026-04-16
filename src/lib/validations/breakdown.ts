import { z } from "zod";
import { BreakdownType, BreakdownPriority, BreakdownStatus } from "@prisma/client";

export const createBreakdownSchema = z.object({
  machineId: z.string().cuid(),
  type: z.nativeEnum(BreakdownType),
  priority: z.nativeEnum(BreakdownPriority),
  description: z.string().min(10).max(5000),
});

export const transitionBreakdownSchema = z.object({
  status: z.nativeEnum(BreakdownStatus),
  assigneeId: z.string().cuid().optional(),
  note: z.string().max(2000).optional(),
  resolutionNotes: z.string().max(5000).optional(),
  rootCause: z.string().max(1000).optional(),
});

export type CreateBreakdownInput = z.infer<typeof createBreakdownSchema>;
export type TransitionBreakdownInput = z.infer<typeof transitionBreakdownSchema>;
