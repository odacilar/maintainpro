/**
 * Scheduler Service
 *
 * Runs periodic background tasks: breakdown escalation, missed checklist marking,
 * and PM work order generation. Designed to be called by:
 *  - External cron (AWS EventBridge, Vercel Cron) via POST /api/cron/*
 *  - In-process dev-mode interval started by src/lib/scheduler/dev-scheduler.ts
 *
 * Uses unsafePrisma / withSuperAdminTx since these jobs cross tenant boundaries.
 */

import { BreakdownPriority, BreakdownStatus, Role } from "@prisma/client";
import { unsafePrisma, withSuperAdminTx } from "@/lib/tenant/prisma";
import { createNotifications } from "@/lib/services/notification-service";
import { generateWorkOrders } from "@/lib/services/pm-service";
import { events } from "@/lib/events";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Task A: Breakdown Escalation
// ---------------------------------------------------------------------------

type EscalationLevel = "ENGINEER" | "FACTORY_ADMIN" | "SUPER_ADMIN";

const ESCALATION_THRESHOLDS: Array<{
  minutes: number;
  level: EscalationLevel;
  noteTag: string;
  criticalOnly: boolean;
}> = [
  { minutes: 30, level: "ENGINEER", noteTag: "escalation:engineer", criticalOnly: false },
  { minutes: 60, level: "FACTORY_ADMIN", noteTag: "escalation:factory_admin", criticalOnly: false },
  { minutes: 120, level: "SUPER_ADMIN", noteTag: "escalation:super_admin", criticalOnly: true },
];

export async function runBreakdownEscalation(): Promise<{ escalated: number }> {
  const now = new Date();
  let escalated = 0;

  // Fetch all OPEN breakdowns across all factories — bypass RLS intentionally
  const openBreakdowns = await unsafePrisma.breakdown.findMany({
    where: { status: BreakdownStatus.OPEN },
    include: {
      timeline: {
        where: { note: { startsWith: "escalation:" } },
        select: { note: true },
      },
      factory: { select: { id: true } },
    },
  });

  for (const breakdown of openBreakdowns) {
    const openedAt = breakdown.reportedAt;
    const ageMinutes = (now.getTime() - openedAt.getTime()) / 60000;

    // Collect escalation tags already written for this breakdown
    const existingTags = new Set(
      breakdown.timeline
        .map((t) => t.note)
        .filter((n): n is string => n !== null),
    );

    for (const threshold of ESCALATION_THRESHOLDS) {
      if (ageMinutes < threshold.minutes) continue;
      if (existingTags.has(threshold.noteTag)) continue; // already escalated at this level
      if (threshold.criticalOnly && breakdown.priority !== BreakdownPriority.CRITICAL) continue;

      // Write escalation marker to timeline (uses bypass_rls so we can write across tenants)
      await withSuperAdminTx(async (tx) => {
        // Re-check inside transaction to avoid race conditions
        const alreadyExists = await tx.breakdownTimeline.findFirst({
          where: { breakdownId: breakdown.id, note: threshold.noteTag },
          select: { id: true },
        });
        if (alreadyExists) return;

        // Use a system user: pick first SUPER_ADMIN or fall back to reporter
        const systemUser = await tx.user.findFirst({
          where: { role: Role.SUPER_ADMIN },
          select: { id: true },
        });
        const actorId = systemUser?.id ?? breakdown.reporterId;

        await tx.breakdownTimeline.create({
          data: {
            breakdownId: breakdown.id,
            factoryId: breakdown.factoryId,
            userId: actorId,
            fromStatus: BreakdownStatus.OPEN,
            toStatus: BreakdownStatus.OPEN,
            note: threshold.noteTag,
          },
        });

        const body = `${breakdown.code} kodlu arıza ${Math.round(ageMinutes)} dakikadır yanıtsız. Lütfen müdahale ediniz.`;
        const title = "Arıza eskalasyonu";

        if (threshold.level === "SUPER_ADMIN") {
          // Notify all super admins (platform-level — no factoryId)
          const superAdmins = await tx.user.findMany({
            where: { role: Role.SUPER_ADMIN, isActive: true },
            select: { id: true },
          });
          await createNotifications(
            tx,
            superAdmins.map((u) => ({
              userId: u.id,
              factoryId: breakdown.factoryId,
              type: "breakdown.escalated",
              title,
              body,
              referenceType: "breakdown",
              referenceId: breakdown.id,
            })),
          );
        } else {
          // Notify factory users with the target role
          const targetRole =
            threshold.level === "ENGINEER" ? Role.ENGINEER : Role.FACTORY_ADMIN;

          const recipients = await tx.user.findMany({
            where: {
              factoryId: breakdown.factoryId,
              role: targetRole,
              isActive: true,
            },
            select: { id: true },
          });

          await createNotifications(
            tx,
            recipients.map((u) => ({
              userId: u.id,
              factoryId: breakdown.factoryId,
              type: "breakdown.escalated",
              title,
              body,
              referenceType: "breakdown",
              referenceId: breakdown.id,
            })),
          );
        }
      });

      // Publish domain event (fire-and-forget — failures don't abort the loop)
      events
        .publish({
          id: randomUUID(),
          type: "breakdown.escalated",
          factoryId: breakdown.factoryId,
          actorId: null,
          occurredAt: now.toISOString(),
          breakdownId: breakdown.id,
          escalationLevel: threshold.level,
          ageMinutes: Math.round(ageMinutes),
        })
        .catch((err) =>
          console.error("[scheduler] event publish failed:", err),
        );

      escalated++;
    }
  }

  return { escalated };
}

// ---------------------------------------------------------------------------
// Task B: Missed Checklist Marking
// ---------------------------------------------------------------------------

export async function runMissedChecklistMarking(): Promise<{ marked: number }> {
  const now = new Date();

  // Find all pending (not yet started) records that are past due
  // Schema status values: "pending" | "in_progress" | "completed" | "missed"
  const overdueRecords = await unsafePrisma.checklistRecord.findMany({
    where: {
      status: "pending",
      scheduledFor: { lt: now },
    },
    include: {
      machine: { select: { name: true } },
    },
  });

  if (overdueRecords.length === 0) return { marked: 0 };

  // Bulk-update to "missed"
  await unsafePrisma.checklistRecord.updateMany({
    where: {
      id: { in: overdueRecords.map((r) => r.id) },
    },
    data: { status: "missed" },
  });

  // Create notifications for each assignee
  await withSuperAdminTx(async (tx) => {
    const notifications = overdueRecords.map((record) => ({
      userId: record.userId,
      factoryId: record.factoryId,
      type: "checklist.missed",
      title: "Kaçırılan kontrol listesi",
      body: `${record.machine.name} makinesi için planlanan kontrol listesi kaçırıldı.`,
      referenceType: "checklist",
      referenceId: record.id,
    }));

    await createNotifications(tx, notifications);
  });

  return { marked: overdueRecords.length };
}

// ---------------------------------------------------------------------------
// Task C: Generate PM Work Orders
// ---------------------------------------------------------------------------

export async function runPmWorkOrderGeneration(): Promise<{ created: number }> {
  // Get all distinct factories that have active PM plans
  const factories = await unsafePrisma.factory.findMany({
    where: {
      pmPlans: {
        some: { isActive: true },
      },
    },
    select: { id: true },
  });

  let created = 0;

  for (const factory of factories) {
    try {
      const workOrders = await withSuperAdminTx((tx) =>
        generateWorkOrders(tx, factory.id),
      );
      created += workOrders.length;
    } catch (err) {
      // Log but continue processing other factories
      console.error(
        `[scheduler] PM work order generation failed for factory ${factory.id}:`,
        err,
      );
    }
  }

  return { created };
}
