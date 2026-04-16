export type ChecklistPeriod = "SHIFT_START" | "DAILY" | "WEEKLY" | "MONTHLY";

export type ChecklistItemType = "YES_NO" | "MEASUREMENT" | "PHOTO" | "MULTIPLE_CHOICE";

export type ChecklistRecordStatus = "pending" | "in_progress" | "completed" | "missed";

export type ActionStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED";

export type ActionPriority = "URGENT" | "NORMAL" | "INFO";

export interface ChecklistItem {
  id: string;
  templateId: string;
  orderIndex: number;
  title: string;
  type: ChecklistItemType;
  referenceValue?: string | null;
  photoRequired: boolean;
  meta?: { choices?: string[] } | null;
}

export interface ChecklistTemplate {
  id: string;
  factoryId: string;
  machineId: string;
  name: string;
  period: ChecklistPeriod;
  isActive: boolean;
  assignedRoles: string[];
  items: ChecklistItem[];
  machine?: { id: string; name: string; code: string };
  _count?: { items: number; records: number };
}

export interface ItemResponse {
  id: string;
  recordId: string;
  itemId: string;
  valueBool?: boolean | null;
  valueNumber?: number | null;
  valueText?: string | null;
  isAbnormal: boolean;
  note?: string | null;
  item?: ChecklistItem;
}

export interface Action {
  id: string;
  factoryId: string;
  code: string;
  recordId: string;
  description: string;
  priority: ActionPriority;
  assigneeId?: string | null;
  targetDate?: string | null;
  status: ActionStatus;
  resolutionNotes?: string | null;
  verifiedById?: string | null;
  createdAt: string;
  assignee?: { id: string; name: string | null } | null;
  record?: { template: { name: string } };
  itemResponse?: ItemResponse | null;
}

export interface ChecklistRecord {
  id: string;
  factoryId: string;
  templateId: string;
  userId: string;
  machineId: string;
  scheduledFor: string;
  startedAt?: string | null;
  completedAt?: string | null;
  status: ChecklistRecordStatus;
  template?: ChecklistTemplate;
  machine?: { id: string; name: string; code: string };
  user?: { id: string; name: string | null; email: string };
  responses?: ItemResponse[];
  actions?: Action[];
}
