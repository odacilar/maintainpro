import { NextResponse } from "next/server";
import { auth } from "./auth";
import {
  runWithTenant,
  type Role,
  type TenantContext,
} from "@/lib/tenant/context";

export type AuthenticatedHandler<T = unknown> = (
  ctx: TenantContext,
) => Promise<T>;

export type AuthOptions = {
  roles?: Role[];
  allowSuperAdmin?: boolean;
};

/**
 * Wraps an API route handler with:
 *   1. Session read + 401 if missing
 *   2. Role check + 403 if role not allowed
 *   3. AsyncLocalStorage tenant context so any `withFactoryTx` call downstream
 *      sees the caller's factoryId and role automatically.
 *
 * Usage:
 *   export async function GET() {
 *     return withApiTenant({ roles: ["ENGINEER", "FACTORY_ADMIN"] }, async (ctx) => {
 *       const machines = await withFactoryTx((tx) => tx.machine.findMany());
 *       return NextResponse.json(machines);
 *     });
 *   }
 */
export async function withApiTenant<T>(
  options: AuthOptions,
  handler: AuthenticatedHandler<T>,
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { role, factoryId, id: userId } = session.user;

  if (options.roles && !options.roles.includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ctx: TenantContext = {
    userId,
    role,
    factoryId,
    bypassRls: role === "SUPER_ADMIN" && options.allowSuperAdmin === true,
  };

  if (role !== "SUPER_ADMIN" && !factoryId) {
    return NextResponse.json(
      { error: "user has no factory assigned" },
      { status: 403 },
    );
  }

  const result = await runWithTenant(ctx, async () => handler(ctx));

  if (result instanceof Response) return result;
  return NextResponse.json(result);
}
