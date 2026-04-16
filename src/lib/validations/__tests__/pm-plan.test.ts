import { describe, it, expect } from "vitest";
import {
  createPmPlanSchema,
  updatePmPlanSchema,
  createWorkOrderSchema,
  updateWorkOrderSchema,
  transitionWorkOrderSchema,
  PmFrequency,
  PmPriority,
  FREQUENCY_INTERVAL_DAYS,
} from "@/lib/validations/pm-plan";
import { WorkOrderStatus } from "@prisma/client";

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx01";

// ---------------------------------------------------------------------------
// FREQUENCY_INTERVAL_DAYS mapping
// ---------------------------------------------------------------------------

describe("FREQUENCY_INTERVAL_DAYS mapping", () => {
  it("DAILY maps to 1", () => expect(FREQUENCY_INTERVAL_DAYS.DAILY).toBe(1));
  it("WEEKLY maps to 7", () => expect(FREQUENCY_INTERVAL_DAYS.WEEKLY).toBe(7));
  it("BIWEEKLY maps to 14", () => expect(FREQUENCY_INTERVAL_DAYS.BIWEEKLY).toBe(14));
  it("MONTHLY maps to 30", () => expect(FREQUENCY_INTERVAL_DAYS.MONTHLY).toBe(30));
  it("QUARTERLY maps to 90", () => expect(FREQUENCY_INTERVAL_DAYS.QUARTERLY).toBe(90));
  it("BIANNUAL maps to 180", () => expect(FREQUENCY_INTERVAL_DAYS.BIANNUAL).toBe(180));
  it("ANNUAL maps to 365", () => expect(FREQUENCY_INTERVAL_DAYS.ANNUAL).toBe(365));

  it("all PmFrequency values have a mapping", () => {
    for (const freq of Object.values(PmFrequency)) {
      expect(FREQUENCY_INTERVAL_DAYS[freq]).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// createPmPlanSchema
// ---------------------------------------------------------------------------

describe("createPmPlanSchema", () => {
  const validPlan = {
    machineId: VALID_CUID,
    title: "Aylık yağlama planı",
    frequency: PmFrequency.MONTHLY,
    priority: PmPriority.MEDIUM,
    isActive: true,
  };

  it("accepts a valid plan with required fields only", () => {
    expect(createPmPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("applies default isActive=true when omitted", () => {
    const { isActive: _, ...withoutActive } = validPlan;
    const result = createPmPlanSchema.safeParse(withoutActive);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isActive).toBe(true);
  });

  it("accepts all optional fields", () => {
    expect(
      createPmPlanSchema.safeParse({
        ...validPlan,
        description: "Her ay yapılacak yağlama işlemi.",
        estimatedMinutes: 60,
        assigneeId: VALID_CUID,
        instructions: "Adım 1: Kapağı aç\nAdım 2: Yağ ekle",
      }).success
    ).toBe(true);
  });

  it("rejects invalid machineId", () => {
    expect(
      createPmPlanSchema.safeParse({ ...validPlan, machineId: "not-a-cuid" }).success
    ).toBe(false);
  });

  it("rejects empty title", () => {
    expect(createPmPlanSchema.safeParse({ ...validPlan, title: "" }).success).toBe(false);
  });

  it("rejects title longer than 200 chars", () => {
    expect(
      createPmPlanSchema.safeParse({ ...validPlan, title: "t".repeat(201) }).success
    ).toBe(false);
  });

  it("rejects invalid frequency", () => {
    expect(
      createPmPlanSchema.safeParse({ ...validPlan, frequency: "HOURLY" }).success
    ).toBe(false);
  });

  it("rejects invalid priority", () => {
    expect(
      createPmPlanSchema.safeParse({ ...validPlan, priority: "EXTREME" }).success
    ).toBe(false);
  });

  it("rejects description longer than 2000 chars", () => {
    expect(
      createPmPlanSchema.safeParse({
        ...validPlan,
        description: "d".repeat(2001),
      }).success
    ).toBe(false);
  });

  it("rejects estimatedMinutes that is not a positive integer", () => {
    expect(
      createPmPlanSchema.safeParse({ ...validPlan, estimatedMinutes: -5 }).success
    ).toBe(false);
    expect(
      createPmPlanSchema.safeParse({ ...validPlan, estimatedMinutes: 0 }).success
    ).toBe(false);
  });

  it("rejects instructions longer than 5000 chars", () => {
    expect(
      createPmPlanSchema.safeParse({
        ...validPlan,
        instructions: "i".repeat(5001),
      }).success
    ).toBe(false);
  });

  it("accepts all valid PmFrequency values", () => {
    for (const frequency of Object.values(PmFrequency)) {
      expect(
        createPmPlanSchema.safeParse({ ...validPlan, frequency }).success,
        `frequency ${frequency} should be valid`
      ).toBe(true);
    }
  });

  it("accepts all valid PmPriority values", () => {
    for (const priority of Object.values(PmPriority)) {
      expect(
        createPmPlanSchema.safeParse({ ...validPlan, priority }).success,
        `priority ${priority} should be valid`
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updatePmPlanSchema (partial of createPmPlanSchema)
// ---------------------------------------------------------------------------

describe("updatePmPlanSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(updatePmPlanSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with only isActive", () => {
    expect(updatePmPlanSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("rejects invalid field values even in partial mode", () => {
    expect(
      updatePmPlanSchema.safeParse({ frequency: "INVALID" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createWorkOrderSchema
// ---------------------------------------------------------------------------

describe("createWorkOrderSchema", () => {
  const validWO = {
    machineId: VALID_CUID,
    scheduledDate: "2026-04-20T08:00:00.000Z",
  };

  it("accepts minimal valid work order", () => {
    expect(createWorkOrderSchema.safeParse(validWO).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    expect(
      createWorkOrderSchema.safeParse({
        ...validWO,
        pmPlanId: VALID_CUID,
        assigneeId: VALID_CUID,
        notes: "Bakım öncesi makineyi durdur.",
      }).success
    ).toBe(true);
  });

  it("rejects invalid machineId", () => {
    expect(
      createWorkOrderSchema.safeParse({ ...validWO, machineId: "bad" }).success
    ).toBe(false);
  });

  it("rejects invalid scheduledDate (not ISO datetime)", () => {
    expect(
      createWorkOrderSchema.safeParse({ ...validWO, scheduledDate: "20-04-2026" }).success
    ).toBe(false);
  });

  it("rejects notes longer than 2000 chars", () => {
    expect(
      createWorkOrderSchema.safeParse({ ...validWO, notes: "n".repeat(2001) }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateWorkOrderSchema
// ---------------------------------------------------------------------------

describe("updateWorkOrderSchema", () => {
  it("accepts empty object", () => {
    expect(updateWorkOrderSchema.safeParse({}).success).toBe(true);
  });

  it("accepts status update", () => {
    expect(
      updateWorkOrderSchema.safeParse({ status: WorkOrderStatus.IN_PROGRESS }).success
    ).toBe(true);
  });

  it("rejects negative actualDurationMinutes", () => {
    expect(
      updateWorkOrderSchema.safeParse({ actualDurationMinutes: -1 }).success
    ).toBe(false);
  });

  it("rejects zero actualDurationMinutes", () => {
    expect(
      updateWorkOrderSchema.safeParse({ actualDurationMinutes: 0 }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transitionWorkOrderSchema
// ---------------------------------------------------------------------------

describe("transitionWorkOrderSchema", () => {
  it("accepts valid transition with status only", () => {
    expect(
      transitionWorkOrderSchema.safeParse({ status: WorkOrderStatus.COMPLETED }).success
    ).toBe(true);
  });

  it("accepts optional notes", () => {
    expect(
      transitionWorkOrderSchema.safeParse({
        status: WorkOrderStatus.CANCELLED,
        notes: "Üretim durumu nedeniyle iptal edildi.",
      }).success
    ).toBe(true);
  });

  it("rejects missing status", () => {
    expect(transitionWorkOrderSchema.safeParse({}).success).toBe(false);
  });

  it("rejects notes longer than 2000 chars", () => {
    expect(
      transitionWorkOrderSchema.safeParse({
        status: WorkOrderStatus.COMPLETED,
        notes: "n".repeat(2001),
      }).success
    ).toBe(false);
  });

  it("accepts all valid WorkOrderStatus values", () => {
    for (const status of Object.values(WorkOrderStatus)) {
      expect(
        transitionWorkOrderSchema.safeParse({ status }).success,
        `status ${status} should be valid`
      ).toBe(true);
    }
  });
});
