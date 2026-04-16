import type { PmFrequency, PmPriority } from "@/lib/validations/pm-plan";

export function frequencyLabel(frequency: string): string {
  const map: Record<string, string> = {
    DAILY: "Günlük",
    WEEKLY: "Haftalık",
    BIWEEKLY: "2 Haftalık",
    MONTHLY: "Aylık",
    QUARTERLY: "3 Aylık",
    BIANNUAL: "6 Aylık",
    ANNUAL: "Yıllık",
  };
  return map[frequency] ?? frequency;
}

export function priorityLabel(priority: string): string {
  const map: Record<string, string> = {
    CRITICAL: "Kritik",
    HIGH: "Yüksek",
    MEDIUM: "Orta",
    LOW: "Düşük",
  };
  return map[priority] ?? priority;
}

export function priorityVariant(
  priority: string
): "danger" | "warning" | "default" | "secondary" {
  const map: Record<string, "danger" | "warning" | "default" | "secondary"> = {
    CRITICAL: "danger",
    HIGH: "warning",
    MEDIUM: "default",
    LOW: "secondary",
  };
  return map[priority] ?? "default";
}

export function workOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PLANNED: "Planlandı",
    IN_PROGRESS: "Devam Ediyor",
    COMPLETED: "Tamamlandı",
    CANCELLED: "İptal Edildi",
  };
  return map[status] ?? status;
}

export function workOrderStatusVariant(
  status: string
): "default" | "warning" | "success" | "secondary" | "danger" {
  const map: Record<string, "default" | "warning" | "success" | "secondary" | "danger"> = {
    PLANNED: "default",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    CANCELLED: "secondary",
  };
  return map[status] ?? "default";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PM_FREQUENCIES: PmFrequency[] = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "ANNUAL",
];

export const PM_PRIORITIES: PmPriority[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export const WORK_ORDER_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

// Derive priority and frequency from the PmPlan's maintenanceType field
// maintenanceType is stored as "PRIORITY:description"
export function parsePriority(maintenanceType: string): string {
  return maintenanceType.split(":")[0] ?? "MEDIUM";
}

export function parseDescription(maintenanceType: string): string {
  const parts = maintenanceType.split(":");
  return parts.slice(1).join(":") ?? "";
}

// Derive frequency from intervalDays
export function intervalDaysToFrequency(days: number): PmFrequency {
  if (days <= 1) return "DAILY";
  if (days <= 7) return "WEEKLY";
  if (days <= 14) return "BIWEEKLY";
  if (days <= 30) return "MONTHLY";
  if (days <= 90) return "QUARTERLY";
  if (days <= 180) return "BIANNUAL";
  return "ANNUAL";
}
