export type { Role } from "@/lib/tenant/context";
import type { Role } from "@/lib/tenant/context";

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Süper Admin",
  FACTORY_ADMIN: "Fabrika Yöneticisi",
  ENGINEER: "Mühendis",
  TECHNICIAN: "Teknisyen",
};

export function canAccess(role: Role, requiredRoles: Role[]): boolean {
  return requiredRoles.includes(role);
}
