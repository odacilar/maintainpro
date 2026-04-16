import { describe, it, expect } from "vitest";
import {
  checklistItemSchema,
  createTemplateSchema,
  updateTemplateSchema,
  createRecordSchema,
  itemResponseSchema,
  submitChecklistSchema,
  transitionActionSchema,
  updateActionSchema,
} from "@/lib/validations/checklist";
import { ChecklistItemType, ChecklistPeriod, ActionStatus, ActionPriority, Role } from "@prisma/client";

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx01";

// ---------------------------------------------------------------------------
// checklistItemSchema
// Prisma ChecklistItemType values: YES_NO, MEASUREMENT, PHOTO, MULTIPLE_CHOICE
// ---------------------------------------------------------------------------

describe("checklistItemSchema", () => {
  it("accepts minimal valid item (YES_NO)", () => {
    const result = checklistItemSchema.safeParse({
      title: "Yağ seviyesi kontrol",
      type: ChecklistItemType.YES_NO,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields (MEASUREMENT)", () => {
    const result = checklistItemSchema.safeParse({
      title: "Sıcaklık ölçümü",
      type: ChecklistItemType.MEASUREMENT,
      referenceValue: "≤ 80°C",
      photoRequired: true,
      meta: { unit: "°C", min: 0, max: 100 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts PHOTO type item", () => {
    const result = checklistItemSchema.safeParse({
      title: "Makine fotoğrafı çek",
      type: ChecklistItemType.PHOTO,
      photoRequired: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts MULTIPLE_CHOICE type item", () => {
    const result = checklistItemSchema.safeParse({
      title: "Yağ rengi",
      type: ChecklistItemType.MULTIPLE_CHOICE,
      meta: { choices: ["Temiz", "Kirli", "Siyah"] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = checklistItemSchema.safeParse({
      title: "",
      type: ChecklistItemType.YES_NO,
    });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 300 chars", () => {
    const result = checklistItemSchema.safeParse({
      title: "a".repeat(301),
      type: ChecklistItemType.YES_NO,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = checklistItemSchema.safeParse({
      title: "Kontrol",
      type: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects referenceValue longer than 500 chars", () => {
    const result = checklistItemSchema.safeParse({
      title: "Kontrol",
      type: ChecklistItemType.MEASUREMENT,
      referenceValue: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid ChecklistItemType values", () => {
    for (const type of Object.values(ChecklistItemType)) {
      const result = checklistItemSchema.safeParse({ title: "Test", type });
      expect(result.success, `type ${type} should be valid`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// createTemplateSchema
// ---------------------------------------------------------------------------

describe("createTemplateSchema", () => {
  const validTemplate = {
    machineId: VALID_CUID,
    name: "Günlük Kontrol",
    period: ChecklistPeriod.DAILY,
    assignedRoles: [Role.TECHNICIAN],
    items: [{ title: "Yağ seviyesi", type: ChecklistItemType.YES_NO }],
  };

  it("accepts a valid template", () => {
    expect(createTemplateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("rejects missing machineId", () => {
    const { machineId: _, ...rest } = validTemplate;
    expect(createTemplateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(
      createTemplateSchema.safeParse({ ...validTemplate, name: "" }).success
    ).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    expect(
      createTemplateSchema.safeParse({
        ...validTemplate,
        name: "a".repeat(201),
      }).success
    ).toBe(false);
  });

  it("rejects invalid period", () => {
    expect(
      createTemplateSchema.safeParse({ ...validTemplate, period: "HOURLY" }).success
    ).toBe(false);
  });

  it("rejects empty assignedRoles array", () => {
    expect(
      createTemplateSchema.safeParse({ ...validTemplate, assignedRoles: [] }).success
    ).toBe(false);
  });

  it("rejects empty items array", () => {
    expect(
      createTemplateSchema.safeParse({ ...validTemplate, items: [] }).success
    ).toBe(false);
  });

  it("accepts multiple roles (TECHNICIAN + ENGINEER)", () => {
    expect(
      createTemplateSchema.safeParse({
        ...validTemplate,
        assignedRoles: [Role.TECHNICIAN, Role.ENGINEER],
      }).success
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateTemplateSchema (all fields optional)
// ---------------------------------------------------------------------------

describe("updateTemplateSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(updateTemplateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with only isActive", () => {
    expect(updateTemplateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("accepts partial update with name + period", () => {
    expect(
      updateTemplateSchema.safeParse({
        name: "Yeni isim",
        period: ChecklistPeriod.WEEKLY,
      }).success
    ).toBe(true);
  });

  it("rejects items array with zero items if provided", () => {
    expect(
      updateTemplateSchema.safeParse({ items: [] }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createRecordSchema
// ---------------------------------------------------------------------------

describe("createRecordSchema", () => {
  it("accepts valid input", () => {
    expect(
      createRecordSchema.safeParse({
        templateId: VALID_CUID,
        scheduledFor: "2026-04-13T08:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects invalid templateId", () => {
    expect(
      createRecordSchema.safeParse({
        templateId: "not-a-cuid",
        scheduledFor: "2026-04-13T08:00:00.000Z",
      }).success
    ).toBe(false);
  });

  it("rejects invalid datetime string", () => {
    expect(
      createRecordSchema.safeParse({
        templateId: VALID_CUID,
        scheduledFor: "13-04-2026",
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// itemResponseSchema
// ---------------------------------------------------------------------------

describe("itemResponseSchema", () => {
  it("accepts minimal response (boolean item, not abnormal)", () => {
    expect(
      itemResponseSchema.safeParse({
        itemId: VALID_CUID,
        isAbnormal: false,
      }).success
    ).toBe(true);
  });

  it("accepts abnormal response with note", () => {
    expect(
      itemResponseSchema.safeParse({
        itemId: VALID_CUID,
        valueBool: false,
        isAbnormal: true,
        note: "Yağ seviyesi düşük, ikmal gerekli.",
      }).success
    ).toBe(true);
  });

  it("accepts numeric response", () => {
    expect(
      itemResponseSchema.safeParse({
        itemId: VALID_CUID,
        valueNumber: 78.5,
        isAbnormal: false,
      }).success
    ).toBe(true);
  });

  it("rejects missing isAbnormal", () => {
    expect(
      itemResponseSchema.safeParse({ itemId: VALID_CUID }).success
    ).toBe(false);
  });

  it("rejects note longer than 2000 chars", () => {
    expect(
      itemResponseSchema.safeParse({
        itemId: VALID_CUID,
        isAbnormal: true,
        note: "n".repeat(2001),
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// submitChecklistSchema
// ---------------------------------------------------------------------------

describe("submitChecklistSchema", () => {
  it("accepts at least one response", () => {
    expect(
      submitChecklistSchema.safeParse({
        responses: [{ itemId: VALID_CUID, isAbnormal: false }],
      }).success
    ).toBe(true);
  });

  it("rejects empty responses array", () => {
    expect(submitChecklistSchema.safeParse({ responses: [] }).success).toBe(false);
  });

  it("rejects missing responses field", () => {
    expect(submitChecklistSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transitionActionSchema
// ---------------------------------------------------------------------------

describe("transitionActionSchema", () => {
  it("accepts minimal transition", () => {
    expect(
      transitionActionSchema.safeParse({ status: ActionStatus.IN_PROGRESS }).success
    ).toBe(true);
  });

  it("accepts all optional fields for COMPLETED transition", () => {
    expect(
      transitionActionSchema.safeParse({
        status: ActionStatus.COMPLETED,
        resolutionNotes: "Sorun giderildi, vidalar sıkıldı.",
        assigneeId: VALID_CUID,
        targetDate: "2026-04-20T00:00:00.000Z",
      }).success
    ).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      transitionActionSchema.safeParse({ status: "REJECTED" }).success
    ).toBe(false);
  });

  it("rejects resolutionNotes longer than 5000 chars", () => {
    expect(
      transitionActionSchema.safeParse({
        status: ActionStatus.COMPLETED,
        resolutionNotes: "r".repeat(5001),
      }).success
    ).toBe(false);
  });

  it("rejects invalid assigneeId", () => {
    expect(
      transitionActionSchema.safeParse({
        status: ActionStatus.IN_PROGRESS,
        assigneeId: "not-a-cuid",
      }).success
    ).toBe(false);
  });

  it("accepts all valid ActionStatus values", () => {
    for (const status of Object.values(ActionStatus)) {
      const result = transitionActionSchema.safeParse({ status });
      expect(result.success, `status ${status} should be valid`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateActionSchema
// ---------------------------------------------------------------------------

describe("updateActionSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(updateActionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts priority update", () => {
    expect(
      updateActionSchema.safeParse({ priority: ActionPriority.HIGH }).success
    ).toBe(true);
  });

  it("accepts setting assigneeId to null (unassign)", () => {
    expect(
      updateActionSchema.safeParse({ assigneeId: null }).success
    ).toBe(true);
  });

  it("rejects description shorter than 1 char", () => {
    expect(
      updateActionSchema.safeParse({ description: "" }).success
    ).toBe(false);
  });

  it("rejects description longer than 2000 chars", () => {
    expect(
      updateActionSchema.safeParse({ description: "d".repeat(2001) }).success
    ).toBe(false);
  });

  it("rejects invalid priority", () => {
    expect(
      updateActionSchema.safeParse({ priority: "EXTREME" }).success
    ).toBe(false);
  });
});
