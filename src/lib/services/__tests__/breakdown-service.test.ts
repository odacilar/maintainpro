import { describe, it, expect } from "vitest";
import { isValidTransition } from "@/lib/services/breakdown-service";
import { BreakdownStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Breakdown state machine — isValidTransition
// Spec §4.2:
//   Açık → Atandı → Müdahale Ediliyor ⇄ Parça Bekleniyor → Çözüldü → Kapatıldı
//                                                          ↑         ↓
//                                                          └── Reddet (yetersiz)
// ---------------------------------------------------------------------------

describe("isValidTransition (breakdown state machine)", () => {
  // --- VALID transitions -------------------------------------------------

  it("OPEN → ASSIGNED", () => {
    expect(isValidTransition(BreakdownStatus.OPEN, BreakdownStatus.ASSIGNED)).toBe(true);
  });

  it("ASSIGNED → IN_PROGRESS", () => {
    expect(
      isValidTransition(BreakdownStatus.ASSIGNED, BreakdownStatus.IN_PROGRESS)
    ).toBe(true);
  });

  it("IN_PROGRESS → WAITING_PARTS", () => {
    expect(
      isValidTransition(BreakdownStatus.IN_PROGRESS, BreakdownStatus.WAITING_PARTS)
    ).toBe(true);
  });

  it("IN_PROGRESS → RESOLVED", () => {
    expect(
      isValidTransition(BreakdownStatus.IN_PROGRESS, BreakdownStatus.RESOLVED)
    ).toBe(true);
  });

  it("WAITING_PARTS → IN_PROGRESS (parts arrived)", () => {
    expect(
      isValidTransition(BreakdownStatus.WAITING_PARTS, BreakdownStatus.IN_PROGRESS)
    ).toBe(true);
  });

  it("RESOLVED → CLOSED", () => {
    expect(
      isValidTransition(BreakdownStatus.RESOLVED, BreakdownStatus.CLOSED)
    ).toBe(true);
  });

  it("RESOLVED → IN_PROGRESS (reject / insufficient repair)", () => {
    expect(
      isValidTransition(BreakdownStatus.RESOLVED, BreakdownStatus.IN_PROGRESS)
    ).toBe(true);
  });

  // --- INVALID transitions -----------------------------------------------

  it("OPEN → IN_PROGRESS is invalid (must be assigned first)", () => {
    expect(
      isValidTransition(BreakdownStatus.OPEN, BreakdownStatus.IN_PROGRESS)
    ).toBe(false);
  });

  it("OPEN → RESOLVED is invalid", () => {
    expect(
      isValidTransition(BreakdownStatus.OPEN, BreakdownStatus.RESOLVED)
    ).toBe(false);
  });

  it("OPEN → CLOSED is invalid", () => {
    expect(isValidTransition(BreakdownStatus.OPEN, BreakdownStatus.CLOSED)).toBe(false);
  });

  it("ASSIGNED → RESOLVED is invalid (must go through IN_PROGRESS)", () => {
    expect(
      isValidTransition(BreakdownStatus.ASSIGNED, BreakdownStatus.RESOLVED)
    ).toBe(false);
  });

  it("ASSIGNED → CLOSED is invalid", () => {
    expect(
      isValidTransition(BreakdownStatus.ASSIGNED, BreakdownStatus.CLOSED)
    ).toBe(false);
  });

  it("WAITING_PARTS → RESOLVED is invalid (must go back to IN_PROGRESS first)", () => {
    expect(
      isValidTransition(BreakdownStatus.WAITING_PARTS, BreakdownStatus.RESOLVED)
    ).toBe(false);
  });

  it("RESOLVED → OPEN is invalid", () => {
    expect(
      isValidTransition(BreakdownStatus.RESOLVED, BreakdownStatus.OPEN)
    ).toBe(false);
  });

  // --- Terminal state: CLOSED -------------------------------------------

  it("CLOSED → any status is invalid", () => {
    const allStatuses = Object.values(BreakdownStatus);
    for (const target of allStatuses) {
      expect(isValidTransition(BreakdownStatus.CLOSED, target)).toBe(false);
    }
  });

  // --- Self-transitions --------------------------------------------------

  it("self-transition is always invalid", () => {
    const allStatuses = Object.values(BreakdownStatus);
    for (const status of allStatuses) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });
});
