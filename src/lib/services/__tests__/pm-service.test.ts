import { describe, it, expect } from "vitest";
import { calculateNextDueDate, isValidWorkOrderTransition } from "@/lib/services/pm-service";
import { WorkOrderStatus } from "@prisma/client";
import { FREQUENCY_INTERVAL_DAYS } from "@/lib/validations/pm-plan";

// ---------------------------------------------------------------------------
// calculateNextDueDate
// ---------------------------------------------------------------------------

describe("calculateNextDueDate", () => {
  const base = new Date("2026-01-01T00:00:00.000Z");

  it("DAILY → adds 1 day", () => {
    const result = calculateNextDueDate(base, "DAILY");
    expect(result.getUTCDate()).toBe(2);
    expect(result.getUTCMonth()).toBe(0); // January
  });

  it("WEEKLY → adds 7 days", () => {
    const result = calculateNextDueDate(base, "WEEKLY");
    const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });

  it("BIWEEKLY → adds 14 days", () => {
    const result = calculateNextDueDate(base, "BIWEEKLY");
    const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(14);
  });

  it("MONTHLY → adds 30 days", () => {
    const result = calculateNextDueDate(base, "MONTHLY");
    const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(30);
  });

  it("QUARTERLY → adds 90 days", () => {
    const result = calculateNextDueDate(base, "QUARTERLY");
    const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(90);
  });

  it("BIANNUAL → adds 180 days", () => {
    const result = calculateNextDueDate(base, "BIANNUAL");
    const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(180);
  });

  it("ANNUAL → adds 365 days", () => {
    const result = calculateNextDueDate(base, "ANNUAL");
    const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(365);
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-03-15T12:00:00.000Z");
    const originalTime = input.getTime();
    calculateNextDueDate(input, "MONTHLY");
    expect(input.getTime()).toBe(originalTime);
  });

  it("matches FREQUENCY_INTERVAL_DAYS mapping for all frequencies", () => {
    const frequencies = Object.keys(FREQUENCY_INTERVAL_DAYS) as Array<
      keyof typeof FREQUENCY_INTERVAL_DAYS
    >;
    for (const freq of frequencies) {
      const result = calculateNextDueDate(base, freq);
      const diff = (result.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(FREQUENCY_INTERVAL_DAYS[freq]);
    }
  });
});

// ---------------------------------------------------------------------------
// isValidWorkOrderTransition
// ---------------------------------------------------------------------------

describe("isValidWorkOrderTransition", () => {
  // Valid transitions
  it("PLANNED → IN_PROGRESS is valid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.PLANNED, WorkOrderStatus.IN_PROGRESS)
    ).toBe(true);
  });

  it("PLANNED → CANCELLED is valid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.PLANNED, WorkOrderStatus.CANCELLED)
    ).toBe(true);
  });

  it("IN_PROGRESS → COMPLETED is valid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED)
    ).toBe(true);
  });

  it("IN_PROGRESS → CANCELLED is valid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED)
    ).toBe(true);
  });

  // Terminal states — no outgoing transitions
  it("COMPLETED → anything is invalid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.PLANNED)
    ).toBe(false);
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.IN_PROGRESS)
    ).toBe(false);
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED)
    ).toBe(false);
  });

  it("CANCELLED → anything is invalid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.CANCELLED, WorkOrderStatus.PLANNED)
    ).toBe(false);
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.CANCELLED, WorkOrderStatus.IN_PROGRESS)
    ).toBe(false);
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.CANCELLED, WorkOrderStatus.COMPLETED)
    ).toBe(false);
  });

  // Backwards transitions
  it("IN_PROGRESS → PLANNED is invalid (no going back)", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.PLANNED)
    ).toBe(false);
  });

  it("PLANNED → COMPLETED is invalid (must go through IN_PROGRESS)", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.PLANNED, WorkOrderStatus.COMPLETED)
    ).toBe(false);
  });

  // Self-transitions
  it("same status self-transition is invalid", () => {
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.PLANNED, WorkOrderStatus.PLANNED)
    ).toBe(false);
    expect(
      isValidWorkOrderTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.IN_PROGRESS)
    ).toBe(false);
  });
});
