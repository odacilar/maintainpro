import { describe, it, expect } from "vitest";
import {
  createBreakdownSchema,
  transitionBreakdownSchema,
} from "@/lib/validations/breakdown";
import { BreakdownType, BreakdownPriority, BreakdownStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// createBreakdownSchema
// ---------------------------------------------------------------------------

describe("createBreakdownSchema", () => {
  const validBase = {
    machineId: "clxxxxxxxxxxxxxxxxxxxxxx01",
    type: BreakdownType.ELECTRICAL,
    priority: BreakdownPriority.HIGH,
    description: "Motor sargıları yanmış, ekipman çalışmıyor.",
  };

  it("accepts a valid payload", () => {
    const result = createBreakdownSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects missing machineId", () => {
    const { machineId: _, ...rest } = validBase;
    const result = createBreakdownSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid machineId (not a CUID)", () => {
    const result = createBreakdownSchema.safeParse({ ...validBase, machineId: "not-a-cuid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid BreakdownType", () => {
    const result = createBreakdownSchema.safeParse({ ...validBase, type: "INVALID_TYPE" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid BreakdownPriority", () => {
    const result = createBreakdownSchema.safeParse({ ...validBase, priority: "SUPER_URGENT" });
    expect(result.success).toBe(false);
  });

  it("rejects description shorter than 10 chars", () => {
    const result = createBreakdownSchema.safeParse({ ...validBase, description: "kısa" });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 5000 chars", () => {
    const result = createBreakdownSchema.safeParse({
      ...validBase,
      description: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description exactly 10 chars", () => {
    const result = createBreakdownSchema.safeParse({
      ...validBase,
      description: "1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("accepts description exactly 5000 chars", () => {
    const result = createBreakdownSchema.safeParse({
      ...validBase,
      description: "a".repeat(5000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid BreakdownType values", () => {
    for (const type of Object.values(BreakdownType)) {
      const result = createBreakdownSchema.safeParse({ ...validBase, type });
      expect(result.success, `type ${type} should be valid`).toBe(true);
    }
  });

  it("accepts all valid BreakdownPriority values", () => {
    for (const priority of Object.values(BreakdownPriority)) {
      const result = createBreakdownSchema.safeParse({ ...validBase, priority });
      expect(result.success, `priority ${priority} should be valid`).toBe(true);
    }
  });

  it("accepts Turkish characters in description", () => {
    const result = createBreakdownSchema.safeParse({
      ...validBase,
      description: "Şanzıman yağı sızdırıyor, İğne vana bozuldu.",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// transitionBreakdownSchema
// ---------------------------------------------------------------------------

describe("transitionBreakdownSchema", () => {
  it("accepts minimal valid payload (just status)", () => {
    const result = transitionBreakdownSchema.safeParse({ status: BreakdownStatus.ASSIGNED });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = transitionBreakdownSchema.safeParse({
      status: BreakdownStatus.RESOLVED,
      assigneeId: "clxxxxxxxxxxxxxxxxxxxxxx01",
      note: "Tamir tamamlandı.",
      resolutionNotes: "Yedek parça değiştirildi.",
      rootCause: "Yanlış kullanım",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing status", () => {
    const result = transitionBreakdownSchema.safeParse({
      note: "not going to work",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status value", () => {
    const result = transitionBreakdownSchema.safeParse({ status: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid assigneeId (not a CUID)", () => {
    const result = transitionBreakdownSchema.safeParse({
      status: BreakdownStatus.ASSIGNED,
      assigneeId: "plain-string",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note longer than 2000 chars", () => {
    const result = transitionBreakdownSchema.safeParse({
      status: BreakdownStatus.IN_PROGRESS,
      note: "n".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects resolutionNotes longer than 5000 chars", () => {
    const result = transitionBreakdownSchema.safeParse({
      status: BreakdownStatus.RESOLVED,
      resolutionNotes: "r".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects rootCause longer than 1000 chars", () => {
    const result = transitionBreakdownSchema.safeParse({
      status: BreakdownStatus.RESOLVED,
      rootCause: "r".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid BreakdownStatus values", () => {
    for (const status of Object.values(BreakdownStatus)) {
      const result = transitionBreakdownSchema.safeParse({ status });
      expect(result.success, `status ${status} should be valid`).toBe(true);
    }
  });
});
