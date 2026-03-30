# Feedback — Active Neuro Patient Experience App

## Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- next-auth v5 with Azure AD (Entra ID) provider
- Snowflake Node.js connector (`snowflake-sdk`)
- Deploy to Vercel

## Database
- Account: `ik70694.uk-south.azure`
- Dev schema: `DATAOPS_DEV.COLLECTION_FEEDBACK`
- Service account: `FEEDBACK_SVC`, keypair auth
- Warehouse: `COMPUTE_WH`
- Patient data read from `DATAOPS_PROD.COLLECTION_CARENOTES.PATIENT` and `WARDSTAY`
- Active patients only: `wardstay.actual_end_dttm IS NULL`

## Auth
- Azure AD SSO via next-auth
- User matched to `USERS` table by Azure AD OID → determines their site
- Using shared integrations app reg for dev; dedicated app reg for prod

## App Flow (order matters)
1. Login
2. Dashboard — active patients for my site + outstanding actions
3. Select patient → select stage
4. **Conversation guidance** screen — prompts to follow + checklist to tick (used DURING conversation)
5. **Feedback capture** screen — scored questions (1–5) + attendees + comments + actions (completed AFTER conversation)
6. Submit

**Critical:** The guidance screen and questionnaire are intentionally separated. Do not merge them.

## UI
- Tablet-first, bedside use — large tap targets, minimal clutter
- Tailwind only, no component library unless agreed

## Env vars (see `.env.local.example`)
- `SNOWFLAKE_PRIVATE_KEY` — RSA private key (PEM, newlines as `\n`)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

## Key conventions
- All DB access through `lib/snowflake.ts` — never raw connections in route handlers
- Route handlers live in `app/api/`
- Protected routes wrapped by middleware checking next-auth session
- No ORM — raw SQL via Snowflake SDK
