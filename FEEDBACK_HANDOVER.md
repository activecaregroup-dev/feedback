# Feedback App - Handover Document

## What is this?

A patient experience feedback app for Active Neuro (part of Active Care Group). Concierges use it on a tablet to have structured conversations with patients at 6 stages of their stay, then score a questionnaire. Everything saves to Snowflake.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS
- next-auth with Azure AD provider (currently using a dev password bypass - password: dev2026)
- Snowflake Node.js connector with keypair auth
- Deployed on Vercel from GitHub repo activecaregroup-dev/feedback
- Lucide React for icons

## Snowflake

- Account: ik70694.uk-south.azure
- Database/Schema: DATAOPS_DEV.COLLECTION_FEEDBACK
- Service account: FEEDBACK_SVC
- Role: FEEDBACK_APP_ROLE
- Warehouse: COMPUTE_WH
- All column names are UPPERCASE - do not guess column names

## Tables and Columns

### SITES
Maps ACG sites to CareNotes ward locations.

SITE_ID, SITE_NAME, CARENOTES_LOCATION_IDS (Snowflake ARRAY), SITE_MANAGER_NAME, SITE_MANAGER_EMAIL, CREATED_AT

Currently one site: Nottingham with location IDs [58, 59, 60, 73]. Site manager populated from `MD_PROD.REFERENCE.MASTERSITELIST` (POCMANAGER, POCEMAIL where SITENAME = 'Nottingham').

### USERS
Concierge accounts linked to a site.

USER_ID, AZURE_AD_OID, EMAIL, DISPLAY_NAME, SITE_ID, IS_ACTIVE, CREATED_AT

### PATIENT_ASSIGNMENTS
One patient to one concierge at a time. No shared assignments.

ASSIGNMENT_ID, PATIENT_ID, USER_ID, ASSIGNED_AT, IS_ACTIVE, NAVIGATOR_NAME, CASE_WORKER_NAME

NAVIGATOR_NAME and CASE_WORKER_NAME are nullable free text, scoped to the assignment (not the patient globally - the same patient could be reassigned and the navigator/case worker may change). No FK to a staff list (tech debt, not yet tracked).

### STAGES
6 conversation stages in the patient journey.

STAGE_ID, STAGE_KEY, STAGE_NAME, STAGE_ORDER, REQUIRES_ADMISSION

Values (STAGE_ID, STAGE_KEY, STAGE_NAME, STAGE_ORDER):
- 1, admission, Admission, 1
- 2, early_stay, Early Stay, 2
- 101, day-10, Day 10, 3
- 3, mid_stay, Mid-Stay, 4
- 4, pre_discharge, Pre-Discharge, 5
- 5, follow_up, Follow-Up, 6

Note: STAGE_ID 101 (Day 10) was added after the original 5 stages. STAGE_IDs are not sequential - always order by STAGE_ORDER, never by STAGE_ID. Keep `lib/stage-config.ts` in sync with this table.

### QUESTIONS
Steve's scored questions per stage. Each mapped to a KPI measure and CQC domain.

QUESTION_ID, STAGE_ID, QUESTION_TEXT, QUESTION_TYPE, QUESTION_ORDER, KPI_MEASURE, CQC_DOMAIN, IS_ACG_WIDE

QUESTION_TYPE allowed values: LIKERT (scored 1-4 on the face scale), BOOLEAN (yes/no, discharge marketing questions). Constraint is informational in Snowflake - not enforced at write time.

### CONVERSATION_PROMPTS
Guidance shown to the concierge during the conversation (before the questionnaire).

PROMPT_ID, STAGE_ID, THEME, PROMPT_TEXT, PROMPT_ORDER

### CHECKLIST_ITEMS
Topics the concierge must tick off during conversation. Gates the "Next" button - all must be ticked before proceeding to the questionnaire. Not currently saved to Snowflake.

ITEM_ID, STAGE_ID, ITEM_TEXT, ITEM_ORDER

### SESSIONS
One record per patient per stage. The core transaction table.

SESSION_ID, PATIENT_ID, PATIENT_NAME, STAGE_ID, USER_ID, SITE_ID, STATUS, STARTED_AT, COMPLETED_AT, WHO_PRESENT

STATUS values:
- IN_PROGRESS - session started but not yet submitted
- COMPLETED - full feedback session submitted with question responses
- SKIPPED - stage dismissed by the concierge (e.g. pre-app-launch stages for mid-admission patients). Has no QUESTION_RESPONSES. COMPLETED_AT is set to the skip time. WHO_PRESENT is NULL.

REPORTING: Always filter to STATUS = 'COMPLETED' in score-average queries. SKIPPED sessions must be excluded from averages. Use SKIPPED rows only to confirm a stage was deliberately dismissed.

### CHECKLIST_RESPONSES
Not currently in use - checklist is a UI gate only. Table exists for future use.

RESPONSE_ID, SESSION_ID, ITEM_ID, IS_CHECKED, CREATED_AT

### QUESTION_RESPONSES
Individual scored answers. One row per question per session.

RESPONSE_ID, SESSION_ID, QUESTION_ID, SCORE, CREATED_AT

SCORE is constrained to 0-4 (constraint chk_score_0_to_4, informational in Snowflake):
- 0 = BOOLEAN no
- 1 = BOOLEAN yes, or LIKERT Sad (lowest face)
- 2 = LIKERT Unhappy
- 3 = LIKERT Happy
- 4 = LIKERT Very happy

LIKERT questions render in the UI as 4 Lucide face icons: Angry (1), Frown (2), Smile (3), Laugh (4).

### COMMENTS
Free text feedback per session.

COMMENT_ID, SESSION_ID, COMMENT_TEXT, COMMENT_TYPE, CREATED_AT

COMMENT_TYPE values: GENERAL, WHAT_WENT_WELL, WHAT_TO_IMPROVE

### ACTIONS
To-do items created during feedback. Appear in the dashboard sidebar.

ACTION_ID, SESSION_ID, USER_ID, PATIENT_ID, ACTION_TEXT, STATUS, CREATED_AT, COMPLETED_AT

STATUS values: OPEN, COMPLETE, ARCHIVED

### QUICK_ACTIONS
Ad-hoc to-do items added outside formal feedback sessions. Distinct from ACTIONS (which are tied to a SESSION_ID). Any concierge at the same SITE_ID can complete a quick action.

QUICK_ACTION_ID, PATIENT_ID, SITE_ID, CREATED_BY_USER_ID, ACTION_TEXT, STATUS, CREATED_AT, COMPLETED_AT, COMPLETED_BY_USER_ID

STATUS values: OPEN, COMPLETE, ARCHIVED

FEEDBACK_APP_ROLE has SELECT, INSERT, UPDATE. DELETE is not granted.

### NOTIFICATIONS
Audit log of every email sent by the app.

NOTIFICATION_ID, NOTIFICATION_TYPE, SESSION_ID, RECIPIENT_EMAIL, SUBJECT, STATUS, ERROR_MESSAGE, RESEND_MESSAGE_ID, CREATED_AT

NOTIFICATION_TYPE values: LOW_SCORE_ALERT (live), MARKETING_CASE_STUDY (planned), MARKETING_REVIEW (planned)
STATUS values: SENT, FAILED

Written by `lib/email.ts` on every send attempt, success or failure. Mandatory for GDPR audit on marketing-consent emails.

### CONSENTS
Immutable audit trail of marketing consent captured at Pre-Discharge stage. One row per session where the patient said yes to at least one marketing opt-in.

CONSENT_ID, SESSION_ID, PATIENT_ID, CASE_STUDY_OPT_IN, GOOGLE_REVIEW_OPT_IN, CONSENT_TEXT, CAPTURED_AT, CAPTURED_BY_USER_ID

CASE_STUDY_OPT_IN and GOOGLE_REVIEW_OPT_IN are BOOLEAN (true/false). CONSENT_TEXT stores the verbatim checkbox label shown to the patient at submission time - required for GDPR audit. CAPTURED_AT defaults to CURRENT_TIMESTAMP(). FEEDBACK_APP_ROLE has SELECT and INSERT only - no UPDATE or DELETE. Records must never be modified or removed.

A row is only written when at least one BOOLEAN question in the session has SCORE = 1 (yes) AND the patient has ticked the consent checkbox in the UI. The server validates this before any inserts and returns HTTP 400 if consent is missing.

## External Data Sources

Patient data is read from CareNotes tables in a separate schema:

- DATAOPS_PROD.COLLECTION_CARENOTES.PATIENT - columns used: PATIENT_ID, PATIENT_NAME, DATE_OF_BIRTH
- DATAOPS_PROD.COLLECTION_CARENOTES.WARDSTAY - columns used: PATIENT_ID, LOCATION_ID, ACTUAL_START_DTTM, ACTUAL_END_DTTM, PLANNED_END_DTTM

Site manager data is read from the master site list:

- MD_PROD.REFERENCE.MASTERSITELIST - columns used: SITENAME, POCMANAGER, POCEMAIL

Current patients = ACTUAL_END_DTTM IS NULL at the site's CARENOTES_LOCATION_IDS. The wardstay query must rank across all wardstay rows (ROW_NUMBER partitioned by PATIENT_ID ordered by ACTUAL_START_DTTM DESC) then filter to rn=1 where ACTUAL_END_DTTM IS NULL and LOCATION_ID is in the site's array. Use ARRAY_CONTAINS(LOCATION_ID::VARIANT, CARENOTES_LOCATION_IDS) for the array filter.

## App Flow

1. Login - Azure AD SSO (or dev password bypass)
2. Dashboard - patient cards (left 2/3), actions + due next sidebar (right 1/3), stage filter icons at top, search box
3. Manage patients (/patients) - assign/unassign patients. Left side shows unassigned and assigned-to-others (greyed out with initials). Right side shows my patients. One patient one concierge rule enforced.
4. Patient journey (/patient/[id]) - vertical timeline of all 6 stages with completion status, dates, average scores. Tap due stage to start. Stages with no session that appear before a later completed/skipped stage show a red "Not captured" strip with a "Tap to dismiss" subtitle - tapping inserts a SKIPPED session and removes the strip. The `?notCaptured=true` URL param shows red strips on all non-sessioned stages for visual review (tapping does nothing in this mode).
5. Conversation guidance (/session/guidance) - prompts grouped by theme + checklist. All items must be ticked to proceed.
6. Feedback capture (/session/feedback) - scored questions (LIKERT 1-4 face scale, BOOLEAN yes/no) + who was present + comments + action items. If any BOOLEAN question is answered yes, a consent checkbox appears and must be ticked before submit. Server re-validates this gate before writing any rows.
7. Confirmation screen after submit

## Design

- Dark theme throughout
- Background: #0a0a0f
- Card backgrounds: #141419
- Accent: #ff6b2b (neon orange)
- Secondary text: #8a8a9a
- Borders: #1e1e2a
- Font: Inter
- Tablet-first, tap-friendly
- Stage icons (Lucide React): DoorOpen (Admission), Sunrise (Early Stay), RefreshCw (Mid-Stay), ClipboardCheck (Pre-Discharge), PhoneCall (Follow-Up)
- Footer: v0.1 - Active Care Group

## Email

- Provider: Resend, called via `lib/email.ts`
- Env vars: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` (defaults to `feedback@activecaregroup.co.uk`, marketing to confirm verified domain before go-live)
- All sends route through one shared `sendEmail` function, which writes a NOTIFICATIONS row on success or failure
- `sendEmail` never throws - calling code should fire and forget so email failures don't break the user flow
- Live notification types: LOW_SCORE_ALERT (sent to site manager when any question in a session scores 1)
- Planned: MARKETING_CASE_STUDY, MARKETING_REVIEW (discharge marketing opt-ins)

## Known Issues / Decisions

- Patient 6603 has an unclosed wardstay from Sept 2023 - CareNotes data quality issue, not a bug
- Checklist responses are UI-only (gate for the Next button) - not saved to Snowflake. Table exists if we want to turn persistence on later.
- Dev login hardcoded - remove before go-live (search for "TODO: remove before go-live" in lib/auth.ts and app/login/page.tsx)
- Snowflake timezone set to Europe/London on FEEDBACK_SVC user
- Azure AD app registration not yet created - currently using TalendAPI_2 (client ID ed560e57-b669-4514-85e0-a3a46556561e) for testing. Create a dedicated one before go-live.
- NEXTAUTH_URL in Vercel env vars must match the Vercel deployment URL, not localhost
- TODO: Discharge marketing question wording ("Would you be happy for us to contact you about sharing your story as a case study?" and "Would you be happy to leave us a review on Google?") to be confirmed with Steve before go-live. Wording is in `migrations/add_discharge_marketing_questions.sql` and the CONSENT_TEXT constant in `app/session/feedback/page.tsx`.
- Skipped stages are recorded as SESSION rows with STATUS = 'SKIPPED', no audit trail beyond that. Skip reason text is out of scope.
- The "Not captured" red strip in normal mode only appears for gap stages (a later stage has a session but an earlier one does not). Date-based automatic detection (e.g. stage 1 was due in week 1 of admission) is a future enhancement.

## Rules

- No em dashes anywhere - use commas, hyphens, or restructure sentences
- Do not guess Snowflake column names - use exactly what is documented above
- All Snowflake columns are UPPERCASE
- Do not suggest destructive database operations without confirming backups first
- Date values in source data use DD/MM/YYYY format
