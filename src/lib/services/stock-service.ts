import { StockMovement, StockMovementType } from "@prisma/client";
import { type TenantTx } from "@/lib/tenant/prisma";

// ---------------------------------------------------------------------------
// Typed service error — caught in API routes to return proper HTTP codes
// ---------------------------------------------------------------------------

export class StockServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StockServiceError";
  }
}

// ---------------------------------------------------------------------------
// Result type — carries the created movement plus a flag for low-stock alert
// ---------------------------------------------------------------------------

export type StockMovementResult = {
  movement: StockMovement;
  minimumReached: boolean;
  newBalance: number;
  delta: number;
};

// ---------------------------------------------------------------------------
// Movement types that increase stock
// ---------------------------------------------------------------------------

const STOCK_INCREASE_TYPES = new Set<StockMovementType>([
  StockMovementType.PURCHASE_IN,
  StockMovementType.RETURN_IN,
]);

// Movement types that decrease stock
const STOCK_DECREASE_TYPES = new Set<StockMovementType>([
  StockMovementType.BREAKDOWN_OUT,
  StockMovementType.PM_OUT,
  StockMovementType.SCRAP_OUT,
]);

// ---------------------------------------------------------------------------
// createStockMovement
// ---------------------------------------------------------------------------

export async function createStockMovement(
  tx: TenantTx,
  data: {
    sparePartId: string;
    type: StockMovementType;
    quantity: number;
    machineId?: string;
    breakdownId?: string;
    unitPrice?: number;
    note?: string;
  },
  actorId: string,
  factoryId: string,
): Promise<StockMovementResult> {
  if (data.quantity <= 0) {
    throw new StockServiceError(
      "invalid_quantity",
      "Quantity must be greater than zero",
    );
  }

  const sparePart = await tx.sparePart.findUnique({
    where: { id: data.sparePartId },
  });

  if (!sparePart) {
    throw new StockServiceError("not_found", "Spare part not found");
  }

  const currentStock = Number(sparePart.currentStock);
  const minimumStock = Number(sparePart.minimumStock);
  const unitPriceSnapshot =
    data.unitPrice !== undefined ? data.unitPrice : Number(sparePart.unitPrice);

  let newBalance: number;
  let delta: number;

  if (STOCK_INCREASE_TYPES.has(data.type)) {
    delta = data.quantity;
    newBalance = currentStock + data.quantity;
  } else if (STOCK_DECREASE_TYPES.has(data.type)) {
    if (currentStock < data.quantity) {
      throw new StockServiceError(
        "insufficient_stock",
        `Insufficient stock: available ${currentStock}, requested ${data.quantity}`,
      );
    }
    delta = -data.quantity;
    newBalance = currentStock - data.quantity;
  } else if (data.type === StockMovementType.ADJUSTMENT) {
    // quantity is treated as the new absolute value
    if (data.quantity < 0) {
      throw new StockServiceError(
        "invalid_quantity",
        "Adjustment quantity (new balance) cannot be negative",
      );
    }
    delta = data.quantity - currentStock;
    newBalance = data.quantity;
  } else {
    throw new StockServiceError("invalid_type", "Unknown movement type");
  }

  // Update currentStock atomically within the same transaction
  await tx.sparePart.update({
    where: { id: data.sparePartId },
    data: { currentStock: newBalance },
  });

  const movement = await tx.stockMovement.create({
    data: {
      factoryId,
      sparePartId: data.sparePartId,
      type: data.type,
      quantity: data.quantity,
      unitPriceSnapshot: unitPriceSnapshot,
      machineId: data.machineId ?? null,
      breakdownId: data.breakdownId ?? null,
      userId: actorId,
      note: data.note ?? null,
    },
  });

  const minimumReached = newBalance <= minimumStock;

  return { movement, minimumReached, newBalance, delta };
}
