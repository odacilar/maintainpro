import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runWithTenant, type TenantContext } from "@/lib/tenant/context";
import { withFactoryTx, withSuperAdminTx, unsafePrisma } from "@/lib/tenant/prisma";

/**
 * CRITICAL: tenant isolation smoke test (spec §16).
 *
 * This test asserts that RLS + the Prisma transaction helpers make it
 * impossible for a factory A user to read factory B data. A regression here
 * is the single worst class of bug this system can have.
 *
 * Prerequisites:
 *   1. Postgres running and reachable via DATABASE_URL
 *   2. `npm run db:migrate` — creates the schema
 *   3. `npm run db:rls`     — applies RLS policies from prisma/rls.sql
 *
 * The test seeds two factories, creates one machine in each, and then:
 *   a) Runs a scoped query as factory A — should see 1 row (its own)
 *   b) Runs a scoped query as factory B — should see 1 row (its own)
 *   c) Tries to read factory B's machine while scoped to factory A — should
 *      return zero rows (RLS hides them, Prisma does not throw)
 *   d) Super admin bypass sees both rows
 */

const testFactoryASlug = "__test_isolation_a";
const testFactoryBSlug = "__test_isolation_b";

async function cleanup() {
  // Delete test factories (cascades everything)
  await unsafePrisma.factory.deleteMany({
    where: { slug: { in: [testFactoryASlug, testFactoryBSlug] } },
  });
}

function ctxFor(factoryId: string, userId: string): TenantContext {
  return { userId, factoryId, role: "FACTORY_ADMIN", bypassRls: false };
}

describe("tenant isolation (RLS + withFactoryTx)", () => {
  let factoryAId: string;
  let factoryBId: string;
  let factoryAMachineId: string;
  let factoryBMachineId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    await cleanup();

    // Use superadmin (bypass RLS) to provision two factories
    await runWithTenant(
      { userId: "seed", role: "SUPER_ADMIN", factoryId: null, bypassRls: true },
      async () => {
        const [factoryA, factoryB] = await withSuperAdminTx(async (tx) => {
          const a = await tx.factory.create({
            data: {
              slug: testFactoryASlug,
              name: "Test Factory A",
            },
          });
          const b = await tx.factory.create({
            data: {
              slug: testFactoryBSlug,
              name: "Test Factory B",
            },
          });

          await tx.department.createMany({
            data: [
              { factoryId: a.id, code: "TEST", name: "Test Dept A" },
              { factoryId: b.id, code: "TEST", name: "Test Dept B" },
            ],
          });

          const [deptA, deptB] = await Promise.all([
            tx.department.findFirstOrThrow({
              where: { factoryId: a.id, code: "TEST" },
            }),
            tx.department.findFirstOrThrow({
              where: { factoryId: b.id, code: "TEST" },
            }),
          ]);

          const userA = await tx.user.create({
            data: {
              email: "test-isolation-a@maintainpro.local",
              name: "A",
              passwordHash: "x",
              role: "FACTORY_ADMIN",
              factoryId: a.id,
              departmentId: deptA.id,
            },
          });
          const userB = await tx.user.create({
            data: {
              email: "test-isolation-b@maintainpro.local",
              name: "B",
              passwordHash: "x",
              role: "FACTORY_ADMIN",
              factoryId: b.id,
              departmentId: deptB.id,
            },
          });

          const machineA = await tx.machine.create({
            data: {
              factoryId: a.id,
              departmentId: deptA.id,
              code: "TEST-A-01",
              name: "Machine A1",
              criticality: "B",
            },
          });
          const machineB = await tx.machine.create({
            data: {
              factoryId: b.id,
              departmentId: deptB.id,
              code: "TEST-B-01",
              name: "Machine B1",
              criticality: "B",
            },
          });

          return [
            { ...a, machineId: machineA.id, deptId: deptA.id, userId: userA.id },
            { ...b, machineId: machineB.id, deptId: deptB.id, userId: userB.id },
          ];
        });

        factoryAId = factoryA.id;
        factoryBId = factoryB.id;
        factoryAMachineId = factoryA.machineId;
        factoryBMachineId = factoryB.machineId;
        userAId = factoryA.userId;
        userBId = factoryB.userId;
      },
    );
  });

  afterAll(async () => {
    await cleanup();
    await unsafePrisma.$disconnect();
  });

  it("factory A sees only its own machine", async () => {
    const machines = await runWithTenant(
      ctxFor(factoryAId, userAId),
      async () => withFactoryTx((tx) => tx.machine.findMany()),
    );
    expect(machines).toHaveLength(1);
    expect(machines[0].id).toBe(factoryAMachineId);
  });

  it("factory B sees only its own machine", async () => {
    const machines = await runWithTenant(
      ctxFor(factoryBId, userBId),
      async () => withFactoryTx((tx) => tx.machine.findMany()),
    );
    expect(machines).toHaveLength(1);
    expect(machines[0].id).toBe(factoryBMachineId);
  });

  it("factory A cannot read factory B's machine by id", async () => {
    const stolen = await runWithTenant(
      ctxFor(factoryAId, userAId),
      async () =>
        withFactoryTx((tx) =>
          tx.machine.findUnique({ where: { id: factoryBMachineId } }),
        ),
    );
    expect(stolen).toBeNull();
  });

  it("factory A cannot write into factory B (RLS WITH CHECK)", async () => {
    await expect(
      runWithTenant(ctxFor(factoryAId, userAId), async () =>
        withFactoryTx(async (tx) => {
          return tx.machine.create({
            data: {
              factoryId: factoryBId,
              departmentId: "nonexistent",
              code: "HIJACK-01",
              name: "Hijacked",
              criticality: "A",
            },
          });
        }),
      ),
    ).rejects.toThrow();
  });

  it("super admin sees both factories' machines", async () => {
    const machines = await runWithTenant(
      { userId: "super", role: "SUPER_ADMIN", factoryId: null, bypassRls: true },
      async () => withSuperAdminTx((tx) => tx.machine.findMany({
        where: { factoryId: { in: [factoryAId, factoryBId] } },
      })),
    );
    expect(machines.length).toBeGreaterThanOrEqual(2);
  });
});
