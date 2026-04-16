-- =============================================================================
-- MaintainPro — PostgreSQL Row Level Security policies
-- =============================================================================
--
-- HOW TO APPLY
-- ------------
-- Run AFTER `npx prisma migrate dev` has created all tables:
--
--   psql $DATABASE_URL -f prisma/rls.sql
--
-- SESSION VARIABLES (set by Prisma middleware on every connection/transaction)
-- ---------------------------------------------------------------------------
--   SET LOCAL app.factory_id = '<cuid>';   -- the authenticated tenant
--   SET LOCAL app.bypass_rls = 'on';       -- SUPER_ADMIN only
--
-- SUPER_ADMIN BYPASS
-- ------------------
-- Any database session that sets  app.bypass_rls = 'on'  sees all rows in all
-- tables. The Prisma middleware must ONLY set this for users whose role is
-- SUPER_ADMIN (verified from the server-side session, never from client input).
--
-- POLICY PATTERN
-- --------------
-- Every tenant-scoped table gets:
--   USING  : read / delete filter
--   WITH CHECK : insert / update filter
-- Both check the bypass flag first, then match factoryId.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: reusable inline expression fragments (written as comments for clarity;
-- each policy copies them literally because PostgreSQL has no macro system).
--
--   bypass : current_setting('app.bypass_rls', true) = 'on'
--   match  : "factoryId" = current_setting('app.factory_id', true)
-- ---------------------------------------------------------------------------


-- =============================================================================
-- 2. Subscription
-- =============================================================================

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;

CREATE POLICY subscription_isolation ON "Subscription"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 3. User
-- =============================================================================
-- Design note: SUPER_ADMIN rows have factoryId = NULL (they are platform-level).
-- The policy allows:
--   (a) bypass flag (used only by SUPER_ADMIN sessions), OR
--   (b) factoryId IS NULL (so super-admin rows are never hidden from
--       any authenticated session — needed for self-lookup, login, etc.), OR
--   (c) factoryId matches the current tenant session.
--
-- Application code must still enforce that regular users cannot READ or MUTATE
-- other factories' users; the middleware's factoryId filter handles that.
-- The NULL carve-out here exists only so super-admin account rows are
-- accessible when a factory session does its own user lookup.
-- ---------------------------------------------------------------------------

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON "User"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" IS NULL
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" IS NULL
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 4. Department
-- =============================================================================

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;

CREATE POLICY department_isolation ON "Department"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 5. Machine
-- =============================================================================

ALTER TABLE "Machine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Machine" FORCE ROW LEVEL SECURITY;

CREATE POLICY machine_isolation ON "Machine"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 6. Breakdown
-- =============================================================================

ALTER TABLE "Breakdown" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Breakdown" FORCE ROW LEVEL SECURITY;

CREATE POLICY breakdown_isolation ON "Breakdown"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 7. BreakdownTimeline
-- =============================================================================

ALTER TABLE "BreakdownTimeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BreakdownTimeline" FORCE ROW LEVEL SECURITY;

CREATE POLICY breakdown_timeline_isolation ON "BreakdownTimeline"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 8. SparePart
-- =============================================================================

ALTER TABLE "SparePart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SparePart" FORCE ROW LEVEL SECURITY;

CREATE POLICY spare_part_isolation ON "SparePart"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 9. StockMovement
-- =============================================================================

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" FORCE ROW LEVEL SECURITY;

CREATE POLICY stock_movement_isolation ON "StockMovement"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 10. ChecklistTemplate
-- =============================================================================

ALTER TABLE "ChecklistTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistTemplate" FORCE ROW LEVEL SECURITY;

CREATE POLICY checklist_template_isolation ON "ChecklistTemplate"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 11. ChecklistItem — SKIPPED (no factoryId column)
-- =============================================================================
-- ChecklistItem rows are protected transitively: to read a ChecklistItem the
-- client must first obtain the parent ChecklistTemplate id, which is already
-- gated by the template_isolation policy above. No direct RLS needed.
-- If a future query can reach ChecklistItem without going through the template,
-- add a factoryId column and policy at that time.


-- =============================================================================
-- 12. ChecklistRecord
-- =============================================================================

ALTER TABLE "ChecklistRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistRecord" FORCE ROW LEVEL SECURITY;

CREATE POLICY checklist_record_isolation ON "ChecklistRecord"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 13. ItemResponse — SKIPPED (no factoryId column)
-- =============================================================================
-- ItemResponse rows are protected transitively through ChecklistRecord, which
-- already has RLS. Direct access to ItemResponse without a recordId join is
-- not expected in the application query patterns. Add factoryId + policy here
-- if that assumption changes.


-- =============================================================================
-- 14. Action
-- =============================================================================

ALTER TABLE "Action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Action" FORCE ROW LEVEL SECURITY;

CREATE POLICY action_isolation ON "Action"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 15. PmPlan
-- =============================================================================

ALTER TABLE "PmPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PmPlan" FORCE ROW LEVEL SECURITY;

CREATE POLICY pm_plan_isolation ON "PmPlan"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 16. WorkOrder
-- =============================================================================

ALTER TABLE "WorkOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkOrder" FORCE ROW LEVEL SECURITY;

CREATE POLICY work_order_isolation ON "WorkOrder"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 17. Notification
-- =============================================================================
-- Design note: factoryId is NULLABLE on Notification (super-admin-wide messages
-- have no factory). The policy allows:
--   (a) bypass flag, OR
--   (b) factoryId IS NULL (platform-wide notifications visible to all), OR
--   (c) factoryId matches the current tenant session.
-- Application code must filter by userId so users only see their own notifications.

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;

CREATE POLICY notification_isolation ON "Notification"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" IS NULL
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" IS NULL
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 18. Photo
-- =============================================================================

ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Photo" FORCE ROW LEVEL SECURITY;

CREATE POLICY photo_isolation ON "Photo"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- 19. AuditLog
-- =============================================================================

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_log_isolation ON "AuditLog"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "factoryId" = current_setting('app.factory_id', true)
  );


-- =============================================================================
-- End of rls.sql
-- =============================================================================
