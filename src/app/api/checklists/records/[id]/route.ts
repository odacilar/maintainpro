import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { events } from "@/lib/events";
import { submitChecklistSchema } from "@/lib/validations/checklist";
import {
  startChecklist,
  submitChecklist,
  ServiceError,
} from "@/lib/services/checklist-service";
import { randomUUID } from "crypto";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async () => {
      const { id } = await params;

      const record = await withFactoryTx((tx) =>
        tx.checklistRecord.findUnique({
          where: { id },
          include: {
            template: {
              select: {
                id: true,
                name: true,
                period: true,
                items: { orderBy: { orderIndex: "asc" } },
              },
            },
            machine: { select: { id: true, name: true, code: true } },
            user: { select: { id: true, name: true } },
            responses: {
              include: {
                item: { select: { id: true, title: true, type: true } },
                action: true,
              },
            },
            actions: {
              include: {
                assignee: { select: { id: true, name: true } },
              },
            },
          },
        }),
      );

      if (!record) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }

      return NextResponse.json(record);
    },
  );
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
    async (ctx) => {
      const { id } = await params;
      const { searchParams } = req.nextUrl;
      const action = searchParams.get("action");

      if (action === "start") {
        let result;
        try {
          result = await withFactoryTx((tx) =>
            startChecklist(tx, id),
          );
        } catch (err) {
          if (err instanceof ServiceError) {
            const status =
              err.code === "not_found"
                ? 404
                : err.code === "invalid_state"
                  ? 422
                  : 400;
            return NextResponse.json(
              { error: err.code, message: err.message },
              { status },
            );
          }
          throw err;
        }

        return NextResponse.json(result);
      }

      if (action === "submit") {
        const body: unknown = await req.json();
        const parsed = submitChecklistSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "validation_error", issues: parsed.error.flatten() },
            { status: 400 },
          );
        }

        let result;
        try {
          result = await withFactoryTx((tx) =>
            submitChecklist(
              tx,
              id,
              parsed.data.responses,
              ctx.userId,
              ctx.factoryId!,
            ),
          );
        } catch (err) {
          if (err instanceof ServiceError) {
            const status =
              err.code === "not_found"
                ? 404
                : err.code === "invalid_state"
                  ? 422
                  : 400;
            return NextResponse.json(
              { error: err.code, message: err.message },
              { status },
            );
          }
          throw err;
        }

        const now = new Date().toISOString();

        // Retrieve machineId for the event (record is now completed)
        const machineId = await withFactoryTx((tx) =>
          tx.checklistRecord
            .findUnique({ where: { id }, select: { machineId: true } })
            .then((r) => r?.machineId ?? ""),
        );

        await events.publish({
          id: randomUUID(),
          type: "checklist.completed",
          factoryId: ctx.factoryId ?? null,
          actorId: ctx.userId,
          occurredAt: now,
          recordId: id,
          machineId,
        });

        for (const createdAction of result.createdActions) {
          await events.publish({
            id: randomUUID(),
            type: "action.created",
            factoryId: ctx.factoryId ?? null,
            actorId: ctx.userId,
            occurredAt: now,
            actionId: createdAction.id,
            recordId: id,
          });
        }

        return NextResponse.json(result);
      }

      return NextResponse.json(
        { error: "bad_request", message: "Query param ?action must be 'start' or 'submit'" },
        { status: 400 },
      );
    },
  );
}
