import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidActionTransition, generateActionCode } from "@/lib/services/checklist-service";
import { ActionStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Action state machine — isValidActionTransition
// OPEN → IN_PROGRESS → COMPLETED → VERIFIED
// ---------------------------------------------------------------------------

describe("isValidActionTransition (action state machine)", () => {
  // Valid transitions
  it("OPEN → IN_PROGRESS is valid", () => {
    expect(isValidActionTransition(ActionStatus.OPEN, ActionStatus.IN_PROGRESS)).toBe(true);
  });

  it("IN_PROGRESS → COMPLETED is valid", () => {
    expect(
      isValidActionTransition(ActionStatus.IN_PROGRESS, ActionStatus.COMPLETED)
    ).toBe(true);
  });

  it("COMPLETED → VERIFIED is valid", () => {
    expect(
      isValidActionTransition(ActionStatus.COMPLETED, ActionStatus.VERIFIED)
    ).toBe(true);
  });

  // Invalid transitions
  it("OPEN → COMPLETED is invalid (must go through IN_PROGRESS)", () => {
    expect(
      isValidActionTransition(ActionStatus.OPEN, ActionStatus.COMPLETED)
    ).toBe(false);
  });

  it("OPEN → VERIFIED is invalid", () => {
    expect(
      isValidActionTransition(ActionStatus.OPEN, ActionStatus.VERIFIED)
    ).toBe(false);
  });

  it("IN_PROGRESS → VERIFIED is invalid (must complete first)", () => {
    expect(
      isValidActionTransition(ActionStatus.IN_PROGRESS, ActionStatus.VERIFIED)
    ).toBe(false);
  });

  it("IN_PROGRESS → OPEN is invalid (no going back)", () => {
    expect(
      isValidActionTransition(ActionStatus.IN_PROGRESS, ActionStatus.OPEN)
    ).toBe(false);
  });

  it("COMPLETED → OPEN is invalid", () => {
    expect(
      isValidActionTransition(ActionStatus.COMPLETED, ActionStatus.OPEN)
    ).toBe(false);
  });

  it("COMPLETED → IN_PROGRESS is invalid", () => {
    expect(
      isValidActionTransition(ActionStatus.COMPLETED, ActionStatus.IN_PROGRESS)
    ).toBe(false);
  });

  // Terminal state
  it("VERIFIED → anything is invalid", () => {
    expect(
      isValidActionTransition(ActionStatus.VERIFIED, ActionStatus.OPEN)
    ).toBe(false);
    expect(
      isValidActionTransition(ActionStatus.VERIFIED, ActionStatus.IN_PROGRESS)
    ).toBe(false);
    expect(
      isValidActionTransition(ActionStatus.VERIFIED, ActionStatus.COMPLETED)
    ).toBe(false);
  });

  // Self-transitions
  it("self-transitions are always invalid", () => {
    const statuses = Object.values(ActionStatus);
    for (const s of statuses) {
      expect(isValidActionTransition(s, s)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// generateActionCode — format OB-AKS-YYYY-NNNN
// ---------------------------------------------------------------------------

describe("generateActionCode", () => {
  const year = new Date().getFullYear();

  it("generates OB-AKS-{YEAR}-0001 when no existing codes", async () => {
    const mockTx = {
      action: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const code = await generateActionCode(mockTx, "factory-id");
    expect(code).toBe(`OB-AKS-${year}-0001`);
  });

  it("increments sequence from last code", async () => {
    const mockTx = {
      action: {
        findFirst: vi.fn().mockResolvedValue({ code: `OB-AKS-${year}-0042` }),
      },
    } as any;

    const code = await generateActionCode(mockTx, "factory-id");
    expect(code).toBe(`OB-AKS-${year}-0043`);
  });

  it("zero-pads sequence to 4 digits", async () => {
    const mockTx = {
      action: {
        findFirst: vi.fn().mockResolvedValue({ code: `OB-AKS-${year}-0009` }),
      },
    } as any;

    const code = await generateActionCode(mockTx, "factory-id");
    expect(code).toBe(`OB-AKS-${year}-0010`);
  });

  it("handles 3-digit sequences correctly (e.g. 999 → 1000)", async () => {
    const mockTx = {
      action: {
        findFirst: vi.fn().mockResolvedValue({ code: `OB-AKS-${year}-0999` }),
      },
    } as any;

    const code = await generateActionCode(mockTx, "factory-id");
    expect(code).toBe(`OB-AKS-${year}-1000`);
  });

  it("matches format OB-AKS-YYYY-NNNN exactly", async () => {
    const mockTx = {
      action: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const code = await generateActionCode(mockTx, "factory-id");
    expect(code).toMatch(/^OB-AKS-\d{4}-\d{4}$/);
  });

  it("uses correct year in the prefix", async () => {
    const mockTx = {
      action: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const code = await generateActionCode(mockTx, "factory-id");
    expect(code.startsWith(`OB-AKS-${year}-`)).toBe(true);
  });
});
