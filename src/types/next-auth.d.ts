// NextAuth type augmentations are declared in src/lib/auth/auth.ts alongside the
// NextAuth configuration. This file exists as an anchor for any additional
// ambient type extensions needed by UI components.
//
// The session shape is:
//   session.user: { id, name, email, image, role: Role, factoryId, factoryName }
// where Role = "SUPER_ADMIN" | "FACTORY_ADMIN" | "ENGINEER" | "TECHNICIAN"
// as defined in @/lib/tenant/context.

export {};
