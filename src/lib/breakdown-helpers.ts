import type { BreakdownStatus, BreakdownPriority, BreakdownType } from "@/types/breakdown";

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    OPEN: "Açık",
    ASSIGNED: "Atandı",
    IN_PROGRESS: "Müdahale Ediliyor",
    WAITING_PARTS: "Parça Bekleniyor",
    RESOLVED: "Çözüldü",
    CLOSED: "Kapatıldı",
  };
  return map[status] ?? status;
}

export function statusVariant(
  status: string
): "danger" | "warning" | "default" | "success" | "secondary" {
  const map: Record<string, "danger" | "warning" | "default" | "success" | "secondary"> = {
    OPEN: "danger",
    ASSIGNED: "warning",
    IN_PROGRESS: "default",
    WAITING_PARTS: "secondary",
    RESOLVED: "success",
    CLOSED: "secondary",
  };
  return map[status] ?? "default";
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
): "danger" | "warning" | "default" | "success" | "secondary" {
  const map: Record<string, "danger" | "warning" | "default" | "success" | "secondary"> = {
    CRITICAL: "danger",
    HIGH: "warning",
    MEDIUM: "default",
    LOW: "secondary",
  };
  return map[priority] ?? "default";
}

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    MECHANICAL: "Mekanik",
    ELECTRICAL: "Elektrik",
    PNEUMATIC: "Pnömatik",
    HYDRAULIC: "Hidrolik",
    SOFTWARE: "Yazılım",
    OTHER: "Diğer",
  };
  return map[type] ?? type;
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

export function formatDowntime(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} sa`;
  return `${hours} sa ${remaining} dk`;
}

export const BREAKDOWN_STATUSES: BreakdownStatus[] = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "RESOLVED",
  "CLOSED",
];

export const BREAKDOWN_PRIORITIES: BreakdownPriority[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export const BREAKDOWN_TYPES: BreakdownType[] = [
  "MECHANICAL",
  "ELECTRICAL",
  "PNEUMATIC",
  "HYDRAULIC",
  "SOFTWARE",
  "OTHER",
];
