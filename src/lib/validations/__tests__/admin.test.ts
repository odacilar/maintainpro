import { describe, it, expect } from "vitest";
import {
  createFactorySchema,
  updateFactorySchema,
  updateSubscriptionSchema,
} from "@/lib/validations/admin";
import { SubscriptionPlan } from "@prisma/client";

// ---------------------------------------------------------------------------
// createFactorySchema
// ---------------------------------------------------------------------------

describe("createFactorySchema", () => {
  const validFactory = {
    name: "ABC Fabrikası",
    slug: "abc-fabrikasi",
    city: "İstanbul",
    plan: SubscriptionPlan.STARTER,
  };

  it("accepts a valid factory", () => {
    expect(createFactorySchema.safeParse(validFactory).success).toBe(true);
  });

  it("accepts optional fields", () => {
    expect(
      createFactorySchema.safeParse({
        ...validFactory,
        address: "Organize Sanayi Bölgesi No:5",
        phone: "+902121234567",
      }).success
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createFactorySchema.safeParse({ ...validFactory, name: "" }).success).toBe(false);
  });

  it("rejects name longer than 200 chars", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, name: "n".repeat(201) }).success
    ).toBe(false);
  });

  it("rejects slug shorter than 2 chars", () => {
    expect(createFactorySchema.safeParse({ ...validFactory, slug: "a" }).success).toBe(false);
  });

  it("rejects slug longer than 60 chars", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "a".repeat(61) }).success
    ).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "ABC-Fabrika" }).success
    ).toBe(false);
  });

  it("rejects slug with special characters other than hyphens", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "abc_fabrika" }).success
    ).toBe(false);
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "abc fabrika" }).success
    ).toBe(false);
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "abc@fabrika" }).success
    ).toBe(false);
  });

  it("accepts slug with lowercase, digits, and hyphens", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "abc-123-fabrika" }).success
    ).toBe(true);
  });

  it("rejects empty city", () => {
    expect(createFactorySchema.safeParse({ ...validFactory, city: "" }).success).toBe(false);
  });

  it("rejects city longer than 100 chars", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, city: "c".repeat(101) }).success
    ).toBe(false);
  });

  it("rejects address longer than 500 chars", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, address: "a".repeat(501) }).success
    ).toBe(false);
  });

  it("rejects phone longer than 20 chars", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, phone: "1".repeat(21) }).success
    ).toBe(false);
  });

  it("rejects invalid subscription plan", () => {
    expect(
      createFactorySchema.safeParse({ ...validFactory, plan: "ULTIMATE" }).success
    ).toBe(false);
  });

  it("accepts all valid SubscriptionPlan values", () => {
    for (const plan of Object.values(SubscriptionPlan)) {
      expect(
        createFactorySchema.safeParse({ ...validFactory, plan }).success,
        `plan ${plan} should be valid`
      ).toBe(true);
    }
  });

  it("rejects Turkish characters in slug (slug must be URL-safe ASCII)", () => {
    // Turkish chars like ş, ç, ğ etc. are not [a-z0-9-]
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "şehir-fabrika" }).success
    ).toBe(false);
    expect(
      createFactorySchema.safeParse({ ...validFactory, slug: "çelik-fabrikası" }).success
    ).toBe(false);
  });

  it("accepts Turkish characters in name and city (those have no ASCII restriction)", () => {
    expect(
      createFactorySchema.safeParse({
        ...validFactory,
        name: "Şahin Çelik Fabrikası",
        city: "Şanlıurfa",
      }).success
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateFactorySchema (partial of createFactorySchema)
// ---------------------------------------------------------------------------

describe("updateFactorySchema", () => {
  it("accepts empty object", () => {
    expect(updateFactorySchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with only name", () => {
    expect(updateFactorySchema.safeParse({ name: "Yeni Fabrika İsmi" }).success).toBe(true);
  });

  it("still rejects invalid slug in partial mode", () => {
    expect(updateFactorySchema.safeParse({ slug: "UPPERCASE" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateSubscriptionSchema
// ---------------------------------------------------------------------------

describe("updateSubscriptionSchema", () => {
  const validSub = {
    plan: SubscriptionPlan.PROFESSIONAL,
    maxUsers: 15,
    maxMachines: 50,
    maxStorageGb: 20,
    isActive: true,
  };

  it("accepts a valid subscription update", () => {
    expect(updateSubscriptionSchema.safeParse(validSub).success).toBe(true);
  });

  it("rejects missing plan", () => {
    const { plan: _, ...rest } = validSub;
    expect(updateSubscriptionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects zero maxUsers (must be positive)", () => {
    expect(
      updateSubscriptionSchema.safeParse({ ...validSub, maxUsers: 0 }).success
    ).toBe(false);
  });

  it("rejects negative maxMachines", () => {
    expect(
      updateSubscriptionSchema.safeParse({ ...validSub, maxMachines: -1 }).success
    ).toBe(false);
  });

  it("rejects zero maxStorageGb", () => {
    expect(
      updateSubscriptionSchema.safeParse({ ...validSub, maxStorageGb: 0 }).success
    ).toBe(false);
  });

  it("rejects non-integer maxUsers", () => {
    expect(
      updateSubscriptionSchema.safeParse({ ...validSub, maxUsers: 5.5 }).success
    ).toBe(false);
  });

  it("rejects missing isActive", () => {
    const { isActive: _, ...rest } = validSub;
    expect(updateSubscriptionSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts all valid SubscriptionPlan values", () => {
    for (const plan of Object.values(SubscriptionPlan)) {
      expect(
        updateSubscriptionSchema.safeParse({ ...validSub, plan }).success,
        `plan ${plan} should be valid`
      ).toBe(true);
    }
  });

  it("accepts ENTERPRISE plan with large limits", () => {
    expect(
      updateSubscriptionSchema.safeParse({
        plan: SubscriptionPlan.ENTERPRISE,
        maxUsers: 999,
        maxMachines: 9999,
        maxStorageGb: 100,
        isActive: true,
      }).success
    ).toBe(true);
  });
});
