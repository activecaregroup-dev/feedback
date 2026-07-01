-- Migration: Seed discharge marketing BOOLEAN questions + create CONSENTS audit table
-- Schema: DATAOPS_DEV.COLLECTION_FEEDBACK
-- Run in: Snowflake worksheet or SnowSQL as SYSADMIN
-- Do NOT run automatically - Claire runs migrations manually

USE SCHEMA DATAOPS_DEV.COLLECTION_FEEDBACK;


-- ============================================================
-- 1. Seed BOOLEAN marketing questions into Pre-Discharge stage
--    STAGE_ID = 4 (Pre-Discharge per STAGES table)
--    QUESTION_ORDER placed after existing Pre-Discharge questions
--    Idempotent: skips insert if question text already exists
-- ============================================================

-- TODO: Steve to confirm wording
INSERT INTO DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS
  (STAGE_ID, QUESTION_TEXT, QUESTION_TYPE, QUESTION_ORDER, KPI_MEASURE, CQC_DOMAIN, IS_ACG_WIDE)
SELECT
  4,
  'Would you be happy for us to contact you about sharing your story as a case study?',
  'BOOLEAN',
  (SELECT COALESCE(MAX(QUESTION_ORDER), 0) + 1 FROM DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS WHERE STAGE_ID = 4),
  NULL,
  NULL,
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS
  WHERE STAGE_ID = 4
    AND QUESTION_TEXT = 'Would you be happy for us to contact you about sharing your story as a case study?'
);

-- TODO: Steve to confirm wording
INSERT INTO DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS
  (STAGE_ID, QUESTION_TEXT, QUESTION_TYPE, QUESTION_ORDER, KPI_MEASURE, CQC_DOMAIN, IS_ACG_WIDE)
SELECT
  4,
  'Would you be happy to leave us a review on Google?',
  'BOOLEAN',
  (SELECT COALESCE(MAX(QUESTION_ORDER), 0) + 1 FROM DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS WHERE STAGE_ID = 4),
  NULL,
  NULL,
  FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS
  WHERE STAGE_ID = 4
    AND QUESTION_TEXT = 'Would you be happy to leave us a review on Google?'
);


-- ============================================================
-- 2. CONSENTS table
--    Audit trail of marketing consent capture per session.
--    One row per session where consent was given.
--    Records are immutable: no UPDATE or DELETE granted.
--    CONSENT_TEXT stores the verbatim checkbox label shown to
--    the patient at submission time for GDPR audit.
-- ============================================================

CREATE TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.CONSENTS (
  CONSENT_ID           NUMBER        AUTOINCREMENT PRIMARY KEY,
  SESSION_ID           NUMBER        NOT NULL  REFERENCES DATAOPS_DEV.COLLECTION_FEEDBACK.SESSIONS(SESSION_ID),
  PATIENT_ID           NUMBER        NOT NULL,
  CASE_STUDY_OPT_IN    BOOLEAN       NOT NULL,
  GOOGLE_REVIEW_OPT_IN BOOLEAN       NOT NULL,
  CONSENT_TEXT         VARCHAR(2000) NOT NULL,
  CAPTURED_AT          TIMESTAMP_NTZ NOT NULL  DEFAULT CURRENT_TIMESTAMP(),
  CAPTURED_BY_USER_ID  NUMBER        NOT NULL  REFERENCES DATAOPS_DEV.COLLECTION_FEEDBACK.USERS(USER_ID)
);

-- SELECT and INSERT only - consent records must not be modified or deleted
GRANT SELECT, INSERT ON TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.CONSENTS TO ROLE FEEDBACK_APP_ROLE;


-- ============================================================
-- 3. Verification
-- ============================================================

DESC TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.CONSENTS;

SHOW GRANTS ON TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.CONSENTS;

SELECT QUESTION_ID, STAGE_ID, QUESTION_TYPE, QUESTION_ORDER, QUESTION_TEXT
FROM   DATAOPS_DEV.COLLECTION_FEEDBACK.QUESTIONS
WHERE  STAGE_ID = 4
ORDER BY QUESTION_ORDER;
