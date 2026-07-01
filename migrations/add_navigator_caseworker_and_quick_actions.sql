-- Migration: Navigator/case worker on PATIENT_ASSIGNMENTS, BOOLEAN question type, QUICK_ACTIONS table
-- Schema: DATAOPS_DEV.COLLECTION_FEEDBACK
-- Run in: Snowflake worksheet or SnowSQL as SYSADMIN
-- Do NOT run automatically - Claire runs migrations manually

USE SCHEMA DATAOPS_DEV.COLLECTION_FEEDBACK;


-- ============================================================
-- 1. Navigator and case worker columns on PATIENT_ASSIGNMENTS
--    Scoped to the assignment, not the patient globally.
--    Free text, no FK to a staff list (tech debt - tracked).
-- ============================================================

ALTER TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.PATIENT_ASSIGNMENTS
  ADD COLUMN NAVIGATOR_NAME   VARCHAR(255),
  ADD COLUMN CASE_WORKER_NAME VARCHAR(255);


-- ============================================================
-- 2. QUESTION_TYPE domain - documentation only
--    Snowflake CHECK constraints via ALTER TABLE are not reliably
--    supported. Allowed values are enforced by the application.
--
--    Allowed QUESTION_TYPE values:
--      LIKERT  - scored 1-4 on the face scale
--      BOOLEAN - yes/no (discharge marketing), stored as SCORE 0/1
-- ============================================================

-- No DDL needed. Value domain is app-enforced.


-- ============================================================
-- 3. QUESTION_RESPONSES.SCORE domain - documentation only
--    Score semantics:
--      0   = BOOLEAN no
--      1   = BOOLEAN yes  (also lowest LIKERT face - Sad)
--      2-4 = LIKERT faces (Unhappy, Happy, Very happy)
--
--    If constraint chk_score_1_to_4 exists from a previous
--    migration run, drop it manually:
--      ALTER TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTION_RESPONSES
--        DROP CONSTRAINT chk_score_1_to_4;
-- ============================================================

-- No DDL needed. Value domain is app-enforced.


-- ============================================================
-- 4. QUICK_ACTIONS table
--    Ad-hoc actions added outside formal feedback sessions.
--    Distinct from ACTIONS (which are tied to a SESSION_ID).
--    Any concierge at the same SITE_ID can complete a quick action.
-- ============================================================

CREATE TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.QUICK_ACTIONS (
  QUICK_ACTION_ID       NUMBER          AUTOINCREMENT PRIMARY KEY,
  PATIENT_ID            NUMBER          NOT NULL,
  SITE_ID               NUMBER          NOT NULL   REFERENCES DATAOPS_DEV.COLLECTION_FEEDBACK.SITES(SITE_ID),
  CREATED_BY_USER_ID    NUMBER          NOT NULL   REFERENCES DATAOPS_DEV.COLLECTION_FEEDBACK.USERS(USER_ID),
  ACTION_TEXT           VARCHAR(2000)   NOT NULL,
  STATUS                VARCHAR(20)     NOT NULL   DEFAULT 'OPEN'
                                                   CHECK (STATUS IN ('OPEN', 'COMPLETE', 'ARCHIVED')),
  CREATED_AT            TIMESTAMP_NTZ   NOT NULL   DEFAULT CURRENT_TIMESTAMP(),
  COMPLETED_AT          TIMESTAMP_NTZ,
  COMPLETED_BY_USER_ID  NUMBER                     REFERENCES DATAOPS_DEV.COLLECTION_FEEDBACK.USERS(USER_ID)
);

-- Grants: SELECT, INSERT, UPDATE only - no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.QUICK_ACTIONS TO ROLE FEEDBACK_APP_ROLE;


-- ============================================================
-- 5. Verification
-- ============================================================

-- New columns on PATIENT_ASSIGNMENTS
DESC TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.PATIENT_ASSIGNMENTS;

-- QUICK_ACTIONS structure
DESC TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.QUICK_ACTIONS;

-- FEEDBACK_APP_ROLE has SELECT, INSERT, UPDATE (no DELETE)
SHOW GRANTS ON TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.QUICK_ACTIONS;
