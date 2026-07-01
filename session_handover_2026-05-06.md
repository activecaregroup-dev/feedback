# Feedback App - Session Handover & Pending Prompts

**Date:** 6 May 2026
**Context:** Feedback received from Steve (post-marketing-team presentation) plus board feedback. Steve presents to the board on Wednesday. This doc captures decisions made, work completed, and prompts ready to fire at Claude Code.

---

## 1. Steve's feedback summary

### From the marketing team
1. **Actions & Comments overview** - single per-patient view pulling everything across stages. Must allow ad-hoc additions outside formal sessions, with tickable completion. Stage titles/order on this page don't currently match the dashboard.
2. **Navigator & Case Worker details** - manually added per patient (Steve corrected "facilitator" -> "navigator" the next morning). Sit above the actions/comments section.
3. **Discharge marketing questions** - two yes/no at end of discharge: contact for case study, leave a Google review. Auto-email marketing@activecaregroup.co.uk on opt-in.
4. **Mid-stay patient handling** - decision needed for patients already mid-journey at launch.

### From the board
5. **Likert change** - 1-5 numbers -> 1-4 sad-to-happy faces (better for brain injury patients).
6. **Score-of-1 alert** - email Site Manager when any question scores 1.
7. **ACG/Active Neuro branding** - replace generic dark theme with proper brand colours, fonts, logos.

---

## 2. Decisions locked in

| Topic | Decision |
|---|---|
| Ad-hoc actions/comments terminology | "Quick Actions" |
| Comments tickable status | No - free text only |
| Navigator/Case Worker storage | Free text now, SSO-driven staff list logged as tech debt |
| GDPR consent for marketing opt-in | On-screen checkbox the patient ticks themselves, captures electronic consent with audit trail |
| "Not captured" stage treatment | Top quarter of stage card shown red with "Not captured" text, rest stays normal styling, can progress past |
| Face icons for 1-4 scale | Lucide React |
| Site Manager email source | New column on SITES table in Snowflake. Also surface "Site Manager: [name]" wherever site name is shown |
| Score-of-1 alert threshold | Score of 1 only |
| Email service | Resend, with NOTIFICATIONS log table for audit |
| Patient journey page layout | 3-column: Comments left, timeline middle, Actions right (per Steve's mockup) |

### Pending decisions
- Body font: Inter (current, my suggestion) vs Arial (brand guide's nominated alternative) vs Avenir Next LT Pro (brand-correct, commercial)
- Logo SVG from marketing team
- Discharge marketing consent wording, needs GDPR/DPIA review

---

## 3. Work already completed this session

### Snowflake STAGES fix (DONE)

**The bug:** `STAGE_ID 2` (Early Stay) and `STAGE_ID 101` (Day 10) both had `STAGE_ORDER = 2`, causing wrong icons and labels on the patient journey page.

**Fixed by:**
1. SQL migration run in Snowflake (Claire confirmed). File: `C:\Users\claire.tasker\ACG_CAREERS\fix_stages_order.sql` (also in conversation outputs).
2. `lib/stage-config.ts` rewritten with all 6 stages, thematic Lucide icons (DoorOpen, Sunrise, CalendarCheck, RefreshCw, ClipboardCheck, PhoneCall), labels matching Snowflake's STAGE_NAME exactly.
3. `FEEDBACK_HANDOVER.md` updated with correct 6-stage info and warning that STAGE_IDs are non-sequential.

**Authoritative stage list now:**

| STAGE_ID | STAGE_KEY | STAGE_NAME | STAGE_ORDER | REQUIRES_ADMISSION |
|---|---|---|---|---|
| 1 | admission | Admission | 1 | true |
| 2 | early_stay | Early Stay | 2 | true |
| 101 | day-10 | Day 10 | 3 | true |
| 3 | mid_stay | Mid-Stay | 4 | true |
| 4 | pre_discharge | Pre-Discharge | 5 | true |
| 5 | follow_up | Follow-Up | 6 | false |

---

## 4. Roadmap of remaining code changes

1. **Brand refresh foundation** - design tokens, fonts, layout chrome. Prompt below (Step 1).
2. **Brand refresh page migration** - replace hardcoded hex in page components with semantic CSS variables. Prompt below (Step 2).
3. **1-4 face scale** - Snowflake constraint change, UI swap to Lucide faces, averages logic updated.
4. **Patient journey page redesign** - 3-column layout, Quick Actions, Navigator/Case Worker fields, "Not captured" red treatment.
5. **Snowflake schema additions** - SITE_MANAGER_NAME/EMAIL on SITES, navigator/case worker fields, BOOLEAN question type, NOTIFICATIONS table, QUICK_ACTIONS table.
6. **Resend integration** - shared email plumbing for all alert types.
7. **Score-of-1 site manager alert** - one email per session summarising low-scoring questions.
8. **Discharge marketing questions + consent checkbox + opt-in email**.
9. **Mid-stay handling** - "Not captured" rendering, no retrofit.

---

## 5. PROMPT - Step 1: Brand refresh foundation

> Hand this prompt to Claude Code. It only touches `globals.css` and `layout.tsx` to set up the design tokens and fonts. Page components are deliberately left for Step 2 to keep diffs reviewable.

---

### Context

The Feedback app currently uses a generic dark theme (`#0a0a0f` background, `#ff6b2b` neon orange accent, Inter font throughout). We need to reskin the entire app to match the official Active Care Group brand guidelines (March 2025 / May 2024).

Key brand requirements:

**Primary palette:**
- ACG Orange `#eb5e34`
- Plum `#381124`
- Sand `#e9daca`
- White `#ffffff`

**Secondary palette (accent only):**
- Green `#0f424b`
- Blue `#1b1a48`

**Typography:**
- Lead/heading: Comfortaa (Google Font, free, OFL). Brand guide specifies tracking of -30, roughly `letter-spacing: -0.03em`.
- Body: Avenir Next LT Pro (commercial, not freely web-available). The brand guidelines nominate Arial as the alternative when lead/body fonts are unavailable. Keep Inter (already loaded) as the body font for now since it's a closer match than Arial. Flag in code comments that this is a deviation pending Avenir Next web licences from marketing.

**Behaviour taglines (for footer):** "kind & honest", "listen, learn & act", "fair & inclusive"

### Design decisions already agreed with the product owner

- Keep dark theme overall (used bedside on tablets in low light) but switch from cold near-black to warm plum, matching ACG's own dark marketing layouts.
- Plum is the deep background, slightly lighter plum tones for cards.
- ACG Orange remains the primary accent (same orange family as current).
- Sand used sparingly for warm highlights and footer text.
- Green and blue from the secondary palette reserved for status indicators only, not chrome.

### What to do in this task

This is **Step 1 of the brand refresh**: foundation only. Do NOT touch page components in this task (they have hardcoded colour values needing a separate, careful pass). The goal is design token foundation so subsequent steps can replace hardcoded values with semantic CSS variables.

#### 1. Update `app/globals.css`

Replace the existing file with:
- Tailwind import as before
- Raw brand variables under `:root` (`--acg-orange`, `--acg-plum`, etc) AND semantic tokens the rest of the app will consume (`--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-accent`, `--color-accent-hover`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-success`, `--color-warning`, `--color-danger`)
- Map semantic tokens like this:
  - `--color-bg`: deep plum, slightly darker than master, e.g. `#2a0d1c`
  - `--color-surface`: master plum `#381124`
  - `--color-surface-raised`: touch lighter than master, e.g. `#4a1a31` for inputs/hover
  - `--color-accent`: `#eb5e34` ACG orange
  - `--color-accent-hover`: darkened orange, e.g. `#d54e26`
  - `--color-text`: white
  - `--color-text-muted`: sand-tinted muted, e.g. `#c9b8a8`
  - `--color-border`: `rgba(233,218,202,0.1)` - sand at low opacity, warm hairline
  - `--color-success`: `#0f424b` ACG green
  - `--color-warning`: keep amber `#f59e0b`, document as deviation
  - `--color-danger`: `#ef4444`
- Add Comfortaa font variable (`--font-display`) alongside existing Inter (`--font-sans`)
- Keep `body` rule but switch it to consume new semantic tokens
- Keep date picker filter rule, update to invert with new accent

Top-of-file comment block: cite brand guide as source, list palette, note Avenir Next deviation.

#### 2. Update `app/layout.tsx`

- Import Comfortaa alongside Inter: `import { Inter, Comfortaa } from "next/font/google";`
- Wire up Comfortaa with `variable: "--font-comfortaa"`, `subsets: ["latin"]`, `weight: ["300", "400", "700"]`
- Add Comfortaa variable class to `<html>` alongside Inter
- Update footer to two rows:
  - Row 1: `kind & honest · listen, learn & act · fair & inclusive`
  - Row 2: `v0.1 · Active Care Group`
  - Use `--color-text-muted`, small text, centred, sand-tinted
- Switch body's inline `style` to consume new CSS variables (`var(--color-bg)`, `var(--color-text)`)

#### 3. Do NOT in this task

- Do NOT replace hardcoded colours inside any page component (dashboard, patient journey, login etc) - those have inline `style` props with literal hex codes that migrate in Step 2
- Do NOT change logos, images, icons
- Do NOT remove or modify the dev login bypass
- Do NOT change typography weights or sizes anywhere outside the new font declarations

### Constraints

- Project rules from `CLAUDE.md` and `AGENTS.md` apply. **Next.js 16.2.1**, React 19, Tailwind v4. Read the relevant guides in `node_modules/next/dist/docs/` before assuming font import APIs.
- **Never use em dashes** in any file (code, comments, docs). Use commas, hyphens, or restructure. Strict project rule.
- All existing functionality must keep working. App must build, lint, run with no regressions. Visual change should be: warmer plum dark theme rather than cold near-black, layout identical.
- Use proper CSS custom properties, not Tailwind theme extensions. The codebase reads CSS variables via inline styles, keep that pattern consistent.

### Acceptance criteria

- `npm run build` succeeds
- `npm run lint` passes
- `globals.css` exposes both raw `--acg-*` and semantic `--color-*` tokens
- `layout.tsx` loads Comfortaa as Google Font with correct weights, exposes `--font-comfortaa`
- Footer shows the three behaviours plus version line
- Loading the dashboard in dev shows new warm-plum background instead of near-black, even though no page component has been touched

---

## 6. PROMPT - Step 2: Brand refresh page migration

> Run this AFTER Step 1 has landed and been reviewed. Replaces hardcoded hex codes in page components with the semantic CSS variables Step 1 introduced.

---

### Context

Step 1 introduced semantic CSS tokens (`--color-bg`, `--color-surface`, `--color-accent`, etc) in `globals.css` and updated `layout.tsx`. Page components still have hardcoded hex values inline (the same colours sometimes written differently in different files).

This task migrates those hardcoded values to consume the semantic tokens, completing the brand refresh.

### Files to migrate

All files containing hardcoded hex colour values:
- `app/dashboard/page.tsx`
- `app/login/page.tsx`
- `app/patient/[patientId]/page.tsx`
- `app/patients/**/*.tsx`
- `app/session/**/*.tsx`
- `app/actions/**/*.tsx`
- `app/password/**/*.tsx` (if any)
- Any other page component

### Hex to token mapping

Replace inline-style hex values with `var(--color-*)` references:

| Old hex | New token |
|---|---|
| `#0a0a0f` | `var(--color-bg)` |
| `#141419` | `var(--color-surface)` |
| `#1e1e2a` | `var(--color-surface-raised)` |
| `#ff6b2b` | `var(--color-accent)` |
| `#fff` / `#ffffff` (as text colour) | `var(--color-text)` |
| `#8a8a9a` (secondary text) | `var(--color-text-muted)` |
| `#4a4a5a` (footer-style text) | `var(--color-text-muted)` |
| `1px solid #1e1e2a` (border) | `1px solid var(--color-border)` |
| `rgba(255,107,43, X)` (accent overlays) | Keep but consider documenting in comment that derives from accent |
| `#38bdf8` (info/success blue) | `var(--color-success)` |
| `#ef4444` / `#f87171` (danger red) | `var(--color-danger)` |
| `#f59e0b` (warning amber) | `var(--color-warning)` |
| `#2a2a3a` (dashed timeline) | A new `--color-divider` token added in Step 1 if not present, otherwise keep |

### What to do per file

1. Read the file
2. List every hardcoded hex value present
3. Replace each with the corresponding `var(--color-*)` reference inline
4. Where a file declares constants like `const ACCENT = '#ff6b2b'` near the top, replace those constants with the semantic token reference at the source
5. Where Tailwind classes are used (e.g. `text-white`), leave them alone - only inline `style={{ }}` blocks need migrating
6. Where a colour is being used in a way that doesn't have a clean token match (e.g. one-off rgba overlays for hover states), leave it hardcoded but add a comment noting it's a derived shade

### Constraints

- Project rules from `CLAUDE.md` and `AGENTS.md` apply. **Next.js 16.2.1**, React 19, Tailwind v4.
- **Never use em dashes** anywhere. Strict project rule.
- Visual output must match Step 1 - this is a refactor not a redesign. The page should look identical to how it looked at the end of Step 1, just sourced from tokens.
- All functionality preserved.
- After this step, search the codebase for any remaining hardcoded hex values and report them in the response so we can decide case by case whether they're intentional one-offs.

### Acceptance criteria

- `npm run build` succeeds
- `npm run lint` passes
- No regressions visible in dashboard, login, patient journey, manage patients, or any session screen
- A grep for `#0a0a0f|#141419|#1e1e2a|#ff6b2b|#8a8a9a` in `app/**/*.tsx` returns zero matches (or only matches inside comments documenting old values)
- The accent constant pattern (`const ACCENT = '#ff6b2b'`) is gone from page files

---

## 7. Notes for next session

### Work completed today

**1-4 face scale (DONE)**
- Snowflake migration written at `migrations/fix_score_scale_1_to_4.sql` - truncates QUESTION_RESPONSES, drops the old 1-5 CHECK, adds 1-4 CHECK
- Feedback capture UI swapped from numeric Likert to 4 Lucide face icons: Angry (1), Frown (2), Smile (3), Laugh (4). All faces render in accent orange. Selected state: filled accent background, white icon. No text labels.
- Averages display updated everywhere: face icon (rounded average) plus numeric `X.X / 4`

**Score-of-1 site manager email alert (DONE)**
- Snowflake migration written at `migrations/add_site_manager_and_notifications.sql` - adds SITE_MANAGER_NAME and SITE_MANAGER_EMAIL to SITES, populates Nottingham from `MD_PROD.REFERENCE.MASTERSITELIST` (POCMANAGER, POCEMAIL), creates NOTIFICATIONS audit table
- Resend integration plumbed in `lib/email.ts` - shared `sendEmail` function, never throws, writes SENT or FAILED row to NOTIFICATIONS
- `app/api/sessions/route.ts` fires `void fireLowScoreAlert(sessionId)` on session COMPLETE - bails silently if no score-of-1, looks up site manager, builds inline-styled HTML email, calls sendEmail. Fire and forget so email failures don't block the user flow
- Env vars added: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` (defaults to `feedback@activecaregroup.co.uk`)
- `.env.local.example` created

**Brand refresh (REVERTED)**
- Step 1 (globals.css tokens, Comfortaa, footer behaviours) and Step 2 (page component migration to semantic tokens) were both run, but the resulting plum-on-plum theme failed contrast on tablets. Lifted-surface contrast fix made it worse. Full revert to the original cold near-black + neon orange theme. The `--acg-*` raw brand variables are kept in globals.css as reference but not consumed.
- Lesson: commit before risky visual changes. Screenshot before iterating.

### Migrations to run

Claire to run the following in Snowflake before deploying the next build:

1. `migrations/fix_score_scale_1_to_4.sql` - score scale change
2. `migrations/add_site_manager_and_notifications.sql` - site manager and notifications

Both have verification SELECTs at the end.

### Pending asks for Steve

- ACG logo SVG
- Body font preference (Inter / Arial / Avenir Next LT Pro)
- Confirm verified Resend sending domain with marketing
- Resend API key provisioning

### Roadmap remaining

3. ~~1-4 face scale~~ DONE
4. Patient journey page redesign - 3-column layout, Quick Actions, Navigator/Case Worker fields, Not captured red treatment
5. Snowflake schema additions - navigator/case worker fields, BOOLEAN question type, QUICK_ACTIONS table (NOTIFICATIONS done, SITE_MANAGER done)
6. ~~Resend integration~~ DONE (as part of score-of-1)
7. ~~Score-of-1 site manager alert~~ DONE
8. Discharge marketing questions - two yes/no, GDPR consent checkbox, opt-in email to marketing@activecaregroup.co.uk
9. Mid-stay handling - Not captured rendering for stages missed because patient was already mid-journey at launch

### Tech debt

A running tech debt list now lives in the obsidian vault at `Feedback app - tech debt.md`. Update it when shortcuts are taken rather than scattering TODO comments.

### Original notes (kept for reference)

- Snowflake STAGES fix is DONE and confirmed by Claire. Code config and handover doc already updated.
