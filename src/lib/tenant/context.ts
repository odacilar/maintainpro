import { AsyncLocalStorage } from "node:async_hooks";

export type Role =
  | "SUPER_ADMIN"
  | "FACTORY_ADMIN"
  | "ENGINEER"
  | "TECHNICIAN";

export type TenantContext = {
  userId: string;
  role: Role;
  factoryId: string | null;
  bypassRls: boolean;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(
  ctx: TenantContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}

export function getTenant(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "Tenant context not set — wrap the handler in runWithTenant().",
    );
  }
  return ctx;
}

export function tryGetTenant(): TenantContext | undefined {
  return storage.getStore();
}

export function requireFactoryId(): string {
  const ctx = getTenant();
  if (!ctx.factoryId) {
    throw new Error(
      "This operation requires a factory-scoped user; super admin has no factoryId.",
    );
  }
  return ctx.factoryId;
}
