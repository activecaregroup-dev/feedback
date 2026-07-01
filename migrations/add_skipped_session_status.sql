-- Migration: Add SKIPPED to SESSIONS.STATUS allowed values
-- Schema: DATAOPS_DEV.COLLECTION_FEEDBACK
-- Run in: Snowflake worksheet or SnowSQL as SYSADMIN
-- Do NOT run automatically - Claire runs migrations manually

USE SCHEMA DATAOPS_DEV.COLLECTION_FEEDBACK;


-- ============================================================
-- 1. Widen STATUS constraint
--
--    Current allowed values: IN_PROGRESS, COMPLETED
--    New allowed values:     IN_PROGRESS, COMPLETED, SKIPPED
--
--    SKIPPED rows represent stages the concierge has dismissed
--    (e.g. stages that pre-date the app going live for a
--    mid-admission patient). They have:
--      - COMPLETED_AT set to the time of dismissal
--      - WHO_PRESENT = NULL
--      - No QUESTION_RESPONSES rows
--
--    REPORTING NOTE: Always filter to STATUS = 'COMPLETED' in
--    score-average queries. SKIPPED sessions have no responses
--    and must be excluded from averages. A SKIPPED row only
--    appears to confirm the stage was deliberately dismissed.
--
--    Note: ALTER TABLE ADD CONSTRAINT CHECK is unreliable in
--    this Snowflake account (see previous migration history).
--    The constraint below is informational. Application code
--    is the enforcement point.
-- ============================================================

-- Drop existing constraint if it exists (may fail silently if not present)
ALTER TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.SESSIONS
  DROP CONSTRAINT IF EXISTS CHK_STATUS;

-- Re-create with SKIPPED included
-- If this fails, skip it - the app enforces valid STATUS values
ALTER TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.SESSIONS
  ADD CONSTRAINT CHK_STATUS
  CHECK (STATUS IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED'))
  ENABLE NOVALIDATE;


-- ============================================================
-- 2. Verification
-- ============================================================

DESC TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.SESSIONS;

SELECT DISTINCT STATUS FROM DATAOPS_DEV.COLLECTION_FEEDBACK.SESSIONS
ORDER BY STATUS;
