import type {
  ChecklistPeriod,
  ChecklistItemType,
  ChecklistRecordStatus,
  ActionStatus,
  ActionPriority,
} from "@/types/checklist";

// ─── Period ───────────────────────────────────────────────────────────────────

export function periodLabel(period: ChecklistPeriod | string): string {
  const map: Record<string, string> = {
    SHIFT_START: "Vardiya Başı",
    DAILY: "Günlük",
    WEEKLY: "Haftalık",
    MONTHLY: "Aylık",
  };
  return map[period] ?? period;
}

export const CHECKLIST_PERIODS: ChecklistPeriod[] = [
  "SHIFT_START",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
];

// ─── Item type ────────────────────────────────────────────────────────────────

export function itemTypeLabel(type: ChecklistItemType | string): string {
  const map: Record<string, string> = {
    YES_NO: "Evet/Hayır",
    MEASUREMENT: "Ölçüm",
    PHOTO: "Fotoğraf",
    MULTIPLE_CHOICE: "Çoktan Seçmeli",
  };
  return map[type] ?? type;
}

export const CHECKLIST_ITEM_TYPES: ChecklistItemType[] = [
  "YES_NO",
  "MEASUREMENT",
  "PHOTO",
  "MULTIPLE_CHOICE",
];

// ─── Record status ────────────────────────────────────────────────────────────

export function recordStatusLabel(status: ChecklistRecordStatus | string): string {
  const map: Record<string, string> = {
    pending: "Bekliyor",
    in_progress: "Devam Ediyor",
    completed: "Tamamlandı",
    missed: "Kaçırıldı",
  };
  return map[status] ?? status;
}

export function recordStatusVariant(
  status: ChecklistRecordStatus | string
): "secondary" | "default" | "success" | "danger" {
  const map: Record<string, "secondary" | "default" | "success" | "danger"> = {
    pending: "secondary",
    in_progress: "default",
    completed: "success",
    missed: "danger",
  };
  return map[status] ?? "secondary";
}

// ─── Action status ────────────────────────────────────────────────────────────

export function actionStatusLabel(status: ActionStatus | string): string {
  const map: Record<string, string> = {
    OPEN: "Açık",
    IN_PROGRESS: "Devam Ediyor",
    COMPLETED: "Tamamlandı",
    VERIFIED: "Doğrulandı",
  };
  return map[status] ?? status;
}

export function actionStatusVariant(
  status: ActionStatus | string
): "danger" | "warning" | "success" | "default" {
  const map: Record<string, "danger" | "warning" | "success" | "default"> = {
    OPEN: "danger",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    VERIFIED: "default",
  };
  return map[status] ?? "default";
}

export const ACTION_STATUSES: ActionStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
];

// ─── Action priority ──────────────────────────────────────────────────────────

export function actionPriorityLabel(priority: ActionPriority | string): string {
  const map: Record<string, string> = {
    URGENT: "Acil",
    NORMAL: "Normal",
    INFO: "Bilgi",
  };
  return map[priority] ?? priority;
}

export function actionPriorityVariant(
  priority: ActionPriority | string
): "danger" | "warning" | "default" {
  const map: Record<string, "danger" | "warning" | "default"> = {
    URGENT: "danger",
    NORMAL: "warning",
    INFO: "default",
  };
  return map[priority] ?? "default";
}

export const ACTION_PRIORITIES: ActionPriority[] = ["URGENT", "NORMAL", "INFO"];
