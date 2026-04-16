import { z } from "zod";
import { StockMovementType } from "@prisma/client";

export const createSparePartSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  unit: z.string().min(1).max(50),
  minimumStock: z.number().int().min(0),
  unitPrice: z.number().positive(),
  description: z.string().max(2000).optional(),
  supplier: z.string().max(200).optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  location: z.string().max(200).optional(),
  barcode: z.string().max(100).optional(),
});

export const updateSparePartSchema = createSparePartSchema.partial();

export const createStockMovementSchema = z.object({
  sparePartId: z.string().cuid(),
  type: z.nativeEnum(StockMovementType),
  quantity: z.number().int().positive(),
  machineId: z.string().cuid().optional(),
  breakdownId: z.string().cuid().optional(),
  unitPrice: z.number().min(0).optional(),
  note: z.string().max(2000).optional(),
});

export type CreateSparePartInput = z.infer<typeof createSparePartSchema>;
export type UpdateSparePartInput = z.infer<typeof updateSparePartSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
