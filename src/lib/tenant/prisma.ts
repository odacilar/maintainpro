import { PrismaClient, Prisma } from "@prisma/client";
import { getTenant, type TenantContext } from "./context";

declare global {
  // eslint-disable-next-line no-var
  var __basePrisma: PrismaClient | undefined;
}

const basePrisma =
  global.__basePrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__basePrisma = basePrisma;
}

export type TenantTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Runs `fn` inside a transaction with RLS session variables set so every
 * Prisma query within the transaction is scoped to the caller's factory.
 *
 * Pattern: `SET LOCAL` is transaction-bound, so this is safe under connection
 * pooling — the variable cannot leak to another request.
 */
export async function withFactoryTx<T>(
  fn: (tx: TenantTx) => Promise<T>,
  options?: { ctx?: TenantContext },
): Promise<T> {
  const ctx = options?.ctx ?? getTenant();

  return basePrisma.$transaction(async (tx) => {
    if (ctx.bypassRls) {
      await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'on'`);
    }
    if (ctx.factoryId) {
      // Parameterised to prevent injection
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.factory_id', ${ctx.factoryId}, true)`,
      );
    } else if (!ctx.bypassRls) {
      throw new Error(
        "withFactoryTx called without factoryId and without bypass_rls — refusing to run a query that would see no rows.",
      );
    }
    return fn(tx as unknown as TenantTx);
  });
}

/**
 * Escape hatch for super-admin and system operations that intentionally
 * need to cross tenant boundaries (e.g. platform metrics, tenant provisioning).
 * Every call site should have an explanatory comment.
 */
export async function withSuperAdminTx<T>(
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'on'`);
    return fn(tx as unknown as TenantTx);
  });
}

/**
 * Raw access for migrations, seeds, and tests. Does not set any RLS context.
 * Never import this from application code — use withFactoryTx instead.
 */
export const unsafePrisma = basePrisma;
