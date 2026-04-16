import type { Machine } from "./machine";

export type BreakdownStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_PARTS"
  | "RESOLVED"
  | "CLOSED";

export type BreakdownPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type BreakdownType =
  | "MECHANICAL"
  | "ELECTRICAL"
  | "PNEUMATIC"
  | "HYDRAULIC"
  | "SOFTWARE"
  | "OTHER";

export interface BreakdownUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export interface BreakdownTimeline {
  id: string;
  breakdownId: string;
  fromStatus: BreakdownStatus | null;
  toStatus: BreakdownStatus;
  note: string | null;
  createdAt: string;
  user: BreakdownUser;
}

export interface Breakdown {
  id: string;
  code: string;
  machineId: string;
  machine: Pick<Machine, "id" | "code" | "name" | "departmentId" | "department">;
  type: BreakdownType;
  priority: BreakdownPriority;
  status: BreakdownStatus;
  description: string;
  resolutionNotes: string | null;
  rootCause: string | null;
  downtimeMinutes: number | null;
  reportedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  factoryId: string;
  reporterId: string;
  reporter: BreakdownUser;
  assigneeId: string | null;
  assignee: BreakdownUser | null;
  timeline: BreakdownTimeline[];
  createdAt: string;
  updatedAt: string;
}

export interface BreakdownListItem {
  id: string;
  code: string;
  machineId: string;
  machine: Pick<Machine, "id" | "code" | "name">;
  type: BreakdownType;
  priority: BreakdownPriority;
  status: BreakdownStatus;
  description: string;
  reportedAt: string;
  reporter: Pick<BreakdownUser, "id" | "name" | "email">;
  assignee: Pick<BreakdownUser, "id" | "name" | "email"> | null;
}

export interface BreakdownCreatePayload {
  machineId: string;
  type: BreakdownType;
  priority: BreakdownPriority;
  description: string;
}

export interface BreakdownTransitionPayload {
  status: BreakdownStatus;
  assigneeId?: string;
  note?: string;
  resolutionNotes?: string;
  rootCause?: string;
}
