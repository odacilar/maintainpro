export type MachineStatus = "RUNNING" | "BROKEN" | "IN_MAINTENANCE" | "DECOMMISSIONED";
export type MachineCriticality = "A" | "B" | "C";

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  _count?: { machines: number };
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  line: string | null;
  status: MachineStatus;
  criticality: MachineCriticality;
  installedAt: string | null;
  warrantyEndsAt: string | null;
  notes: string | null;
  factoryId: string;
  departmentId: string | null;
  department: Department | null;
  createdAt: string;
  updatedAt: string;
}

export interface MachineFormData {
  code: string;
  name: string;
  departmentId: string;
  criticality: MachineCriticality;
  status: MachineStatus;
  line: string;
  brand: string;
  model: string;
  serialNumber: string;
  installedAt: string;
  warrantyEndsAt: string;
  notes: string;
}
