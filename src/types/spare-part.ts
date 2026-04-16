export type SparePartCategory =
  | "MECHANICAL"
  | "ELECTRICAL"
  | "PNEUMATIC"
  | "HYDRAULIC"
  | "CONSUMABLE"
  | "OTHER";

export type SparePartUnit = "PIECE" | "METER" | "KG" | "LITER" | "BOX";

export type StockMovementType = "IN" | "OUT" | "RETURN" | "ADJUSTMENT" | "SCRAP";

export interface SparePart {
  id: string;
  code: string;
  name: string;
  category: SparePartCategory;
  unit: SparePartUnit;
  currentStock: number;
  minimumStock: number;
  unitPrice: number | null;
  description: string | null;
  supplier: string | null;
  leadTimeDays: number | null;
  location: string | null;
  barcode: string | null;
  factoryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SparePartListItem {
  id: string;
  code: string;
  name: string;
  category: SparePartCategory;
  unit: SparePartUnit;
  currentStock: number;
  minimumStock: number;
  unitPrice: number | null;
  location: string | null;
}

export interface StockMovementUser {
  id: string;
  name: string | null;
  email: string;
}

export interface StockMovementMachine {
  id: string;
  code: string;
  name: string;
}

export interface StockMovementBreakdown {
  id: string;
  code: string;
}

export interface StockMovement {
  id: string;
  sparePartId: string;
  type: StockMovementType;
  quantity: number;
  unitPrice: number | null;
  note: string | null;
  createdAt: string;
  user: StockMovementUser;
  machine: StockMovementMachine | null;
  breakdown: StockMovementBreakdown | null;
}

export interface SparePartFormData {
  code: string;
  name: string;
  category: SparePartCategory | "";
  unit: SparePartUnit | "";
  minimumStock: string;
  unitPrice: string;
  description: string;
  supplier: string;
  leadTimeDays: string;
  location: string;
  barcode: string;
}

export interface StockMovementFormData {
  type: StockMovementType;
  quantity: string;
  machineId: string;
  breakdownId: string;
  unitPrice: string;
  note: string;
  newStock: string;
}
