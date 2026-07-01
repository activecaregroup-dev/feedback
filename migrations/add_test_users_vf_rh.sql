-- Migration: add_test_users_vf_rh.sql
-- Purpose: Add vf_test and rh_test login users to the dev environment.
--
-- Context: the dev login form takes a USERNAME + PASSWORD. The credentials
-- provider (lib/auth.ts) looks the user up by USERNAME, verifies the supplied
-- password against PASSWORD_HASH (bcrypt), checks IS_ACTIVE, then resolves the
-- session via AZURE_AD_OID (joined to SITES for the site). So these users need
-- a USERNAME, a non-null AZURE_AD_OID, and a PASSWORD_HASH to actually log in.
--
-- USERS did not previously have USERNAME / PASSWORD_HASH columns, so we add
-- them first (nullable - existing SSO users are unaffected).

ALTER TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.USERS
  ADD COLUMN IF NOT EXISTS USERNAME      VARCHAR;

ALTER TABLE DATAOPS_DEV.COLLECTION_FEEDBACK.USERS
  ADD COLUMN IF NOT EXISTS PASSWORD_HASH VARCHAR;

-- Seed the two test users. PASSWORD_HASH is left NULL here - login is blocked
-- until you set a bcrypt hash (see the UPDATE templates below). AZURE_AD_OID is
-- the post-login resolution key, so each row needs a unique, non-null value.
INSERT INTO DATAOPS_DEV.COLLECTION_FEEDBACK.USERS
(AZURE_AD_OID, USERNAME, EMAIL, DISPLAY_NAME, SITE_ID, PASSWORD_HASH, IS_ACTIVE)
VALUES
('vf-test-oid', 'vf_test', 'vf_test@activecaregroup.co.uk', 'VF Test', 1, NULL, TRUE),
('rh-test-oid', 'rh_test', 'rh_test@activecaregroup.co.uk', 'RH Test', 1, NULL, TRUE);

-- Set the passwords: replace the hashes below with bcrypt hashes you generate.
-- Generate one with:  node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
-- (run from the project root so bcryptjs resolves).
--
UPDATE DATAOPS_DEV.COLLECTION_FEEDBACK.USERS
   SET PASSWORD_HASH = '$2b$10$qKMOtudxj7SbaqmilEtHgON2pW.e7ItDnTWyKu9K8ObkE0C0XpygW'
   WHERE USERNAME = 'vf_test';
--
UPDATE DATAOPS_DEV.COLLECTION_FEEDBACK.USERS
   SET PASSWORD_HASH = '$2b$10$75rTdqJrOR2KywkIj5rMWOpAnWfZohdWieIlBhBhNKCT7HPq88o8y'
   WHERE USERNAME = 'rh_test';

-- Verification
SELECT USER_ID, AZURE_AD_OID, USERNAME, EMAIL, DISPLAY_NAME, SITE_ID,
       PASSWORD_HASH IS NOT NULL AS HAS_PASSWORD, IS_ACTIVE
FROM DATAOPS_DEV.COLLECTION_FEEDBACK.USERS
WHERE USERNAME IN ('vf_test', 'rh_test');
