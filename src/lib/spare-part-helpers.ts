import type { SparePartCategory, SparePartUnit, StockMovementType } from "@/types/spare-part";

export function stockStatusLabel(current: number, minimum: number): string {
  if (current === 0) return "Tükendi";
  if (current <= minimum) return "Düşük";
  return "Yeterli";
}

export function stockStatusVariant(
  current: number,
  minimum: number
): "success" | "warning" | "danger" {
  if (current === 0) return "danger";
  if (current <= minimum) return "warning";
  return "success";
}

export function movementTypeLabel(type: string): string {
  const map: Record<string, string> = {
    IN: "Giriş",
    OUT: "Çıkış",
    RETURN: "İade",
    ADJUSTMENT: "Düzeltme",
    SCRAP: "Hurda",
  };
  return map[type] ?? type;
}

export function movementTypeVariant(
  type: string
): "success" | "danger" | "default" | "warning" | "secondary" {
  const map: Record<string, "success" | "danger" | "default" | "warning" | "secondary"> = {
    IN: "success",
    OUT: "danger",
    RETURN: "default",
    ADJUSTMENT: "warning",
    SCRAP: "secondary",
  };
  return map[type] ?? "default";
}

export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    MECHANICAL: "Mekanik",
    ELECTRICAL: "Elektrik",
    PNEUMATIC: "Pnömatik",
    HYDRAULIC: "Hidrolik",
    CONSUMABLE: "Sarf",
    OTHER: "Diğer",
  };
  return map[category] ?? category;
}

export function unitLabel(unit: string): string {
  const map: Record<string, string> = {
    PIECE: "Adet",
    METER: "Metre",
    KG: "Kg",
    LITER: "Litre",
    BOX: "Kutu",
  };
  return map[unit] ?? unit;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const SPARE_PART_CATEGORIES: SparePartCategory[] = [
  "MECHANICAL",
  "ELECTRICAL",
  "PNEUMATIC",
  "HYDRAULIC",
  "CONSUMABLE",
  "OTHER",
];

export const SPARE_PART_UNITS: SparePartUnit[] = [
  "PIECE",
  "METER",
  "KG",
  "LITER",
  "BOX",
];

export const STOCK_MOVEMENT_TYPES: StockMovementType[] = [
  "IN",
  "OUT",
  "RETURN",
  "ADJUSTMENT",
  "SCRAP",
];
