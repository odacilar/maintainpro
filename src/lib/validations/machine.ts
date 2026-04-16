import { z } from "zod";
import { MachineCriticality, MachineStatus } from "@prisma/client";

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createMachineSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  departmentId: z.string().cuid(),
  criticality: z.nativeEnum(MachineCriticality),
  status: z.nativeEnum(MachineStatus).default(MachineStatus.RUNNING),
  line: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  installedAt: z.coerce.date().optional(),
  warrantyEndsAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateMachineSchema = createMachineSchema.partial();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateMachineInput = z.infer<typeof createMachineSchema>;
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
