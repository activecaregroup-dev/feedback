-- Migration: Change SCORE scale from 1-5 to 1-4
-- Schema: DATAOPS_DEV.COLLECTION_FEEDBACK
-- Run in: Snowflake worksheet or SnowSQL as FEEDBACK_SVC or SYSADMIN

USE SCHEMA DATAOPS_DEV.COLLECTION_FEEDBACK;

-- Step 1: Clear dev data (existing rows used the 1-5 scale and are invalid)
TRUNCATE TABLE QUESTION_RESPONSES;

-- Step 2: Drop the old 1-5 CHECK constraint (informational in Snowflake, but keep schema accurate)
-- Find the constraint name first:
--   SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
--   WHERE TABLE_SCHEMA = 'COLLECTION_FEEDBACK' AND TABLE_NAME = 'QUESTION_RESPONSES'
--   AND CONSTRAINT_TYPE = 'CHECK';
-- Then drop it:
--   ALTER TABLE QUESTION_RESPONSES DROP CONSTRAINT <constraint_name>;

-- Step 3: Add updated CHECK constraint (1-4 scale)
-- NOTE: Snowflake CHECK constraints are informational - not enforced at write time.
-- Application validation in /api/sessions is the enforcement layer.
ALTER TABLE QUESTION_RESPONSES ADD CONSTRAINT chk_score_1_to_4 CHECK (SCORE BETWEEN 1 AND 4) ENABLE NOVALIDATE;

-- Step 4: Verify
SELECT
    CONSTRAINT_NAME,
    CHECK_CLAUSE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    ON tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
WHERE tc.TABLE_SCHEMA = 'COLLECTION_FEEDBACK'
  AND tc.TABLE_NAME = 'QUESTION_RESPONSES';
