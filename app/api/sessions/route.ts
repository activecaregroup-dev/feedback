import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { patientId, patientName, stageId, whoPresent, questionResponses, promptNotes, comments, actions, consent } = body;

    // Server-side consent gate: validate before any inserts
    // If any BOOLEAN question has score 1 (yes), consent must be provided
    if (questionResponses?.length) {
      const questionIds = (questionResponses as { questionId: number }[]).map((r) => r.questionId);
      const questionTypeRows = await query<{ QUESTION_ID: number; QUESTION_TYPE: string }>(
        `SELECT QUESTION_ID, QUESTION_TYPE
         FROM ${FB}.QUESTIONS
         WHERE QUESTION_ID IN (${questionIds.map(() => '?').join(',')})`,
        questionIds
      );
      const typeMap = new Map(questionTypeRows.map((q) => [q.QUESTION_ID, q.QUESTION_TYPE]));

      const anyBooleanYes = (questionResponses as { questionId: number; score: number }[]).some(
        (r) => typeMap.get(r.questionId) === 'BOOLEAN' && r.score === 1
      );

      if (anyBooleanYes && !consent) {
        return NextResponse.json({ error: 'Consent required for marketing opt-ins' }, { status: 400 });
      }

      // Stash for use after inserts (avoid re-querying)
      body._anyBooleanYes = anyBooleanYes;
    }

    // Insert session - Snowflake doesn't support RETURNING, so we query back immediately
    await query(
      `INSERT INTO ${FB}.SESSIONS (PATIENT_ID, PATIENT_NAME, STAGE_ID, USER_ID, SITE_ID, STATUS, WHO_PRESENT, STARTED_AT)
       VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, CURRENT_TIMESTAMP())`,
      [patientId, patientName, stageId, session.user.id, session.user.siteId, whoPresent]
    );

    const sessionRows = await query<{ SESSION_ID: number }>(
      `SELECT MAX(SESSION_ID) AS SESSION_ID
       FROM ${FB}.SESSIONS
       WHERE USER_ID = ? AND PATIENT_ID = ? AND STAGE_ID = ?`,
      [session.user.id, patientId, stageId]
    );

    const sessionId = sessionRows[0].SESSION_ID;

    // Question responses (LIKERT and BOOLEAN stored together)
    if (questionResponses?.length) {
      for (const r of questionResponses as { questionId: number; score: number; note: string | null }[]) {
        await query(
          `INSERT INTO ${FB}.QUESTION_RESPONSES (SESSION_ID, QUESTION_ID, SCORE, NOTE, CREATED_AT) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP())`,
          [sessionId, r.questionId, r.score, r.note ?? null]
        );
      }
    }

    // Prompt notes
    if (promptNotes?.length) {
      for (const pn of promptNotes as { promptId: number; note: string }[]) {
        await query(
          `INSERT INTO ${FB}.PROMPT_NOTES (SESSION_ID, PROMPT_ID, NOTE_TEXT, CREATED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP())`,
          [sessionId, pn.promptId, pn.note]
        );
      }
    }

    // Comments
    if (comments?.trim()) {
      await query(
        `INSERT INTO ${FB}.COMMENTS (SESSION_ID, COMMENT_TEXT, CREATED_AT) VALUES (?, ?, CURRENT_TIMESTAMP())`,
        [sessionId, comments.trim()]
      );
    }

    // Actions
    if (actions?.length) {
      for (const a of actions as { text: string; assignedTo?: string }[]) {
        await query(
          `INSERT INTO ${FB}.ACTIONS (SESSION_ID, USER_ID, PATIENT_ID, ACTION_TEXT, ASSIGNED_TO, STATUS, CREATED_AT) VALUES (?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP())`,
          [sessionId, session.user.id, patientId, a.text, a.assignedTo?.trim() || null]
        );
      }
    }

    // Consent record - written when at least one marketing BOOLEAN opt-in is Yes
    if (body._anyBooleanYes && consent) {
      await query(
        `INSERT INTO ${FB}.CONSENTS
           (SESSION_ID, PATIENT_ID, CASE_STUDY_OPT_IN, GOOGLE_REVIEW_OPT_IN, CONSENT_TEXT, CAPTURED_BY_USER_ID)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          patientId,
          consent.caseStudyOptIn,
          consent.googleReviewOptIn,
          consent.consentText,
          session.user.id,
        ]
      );
    }

    // Fire low score alert without blocking the response
    void fireLowScoreAlert(sessionId).catch((err) => console.error('[low-score-alert]', err));

    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (err) {
    console.error('[/api/sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

type LowScoreRow = {
  QUESTION_TEXT: string;
  KPI_MEASURE: string | null;
  CQC_DOMAIN: string | null;
  SCORE: number;
};

type SessionContextRow = {
  SITE_MANAGER_NAME: string | null;
  SITE_MANAGER_EMAIL: string | null;
  PATIENT_NAME: string;
  PATIENT_ID: number;
  STAGE_NAME: string;
  CONCIERGE_NAME: string;
  COMPLETED_AT: string | null;
  STARTED_AT: string;
};

async function fireLowScoreAlert(sessionId: number) {
  // Only LIKERT questions count for low-score alerts - BOOLEAN "yes" (score=1) is not a low score
  const lowScoreRows = await query<LowScoreRow>(
    `SELECT q.QUESTION_TEXT, q.KPI_MEASURE, q.CQC_DOMAIN, qr.SCORE
     FROM ${FB}.QUESTION_RESPONSES qr
     JOIN ${FB}.QUESTIONS q ON q.QUESTION_ID = qr.QUESTION_ID
     WHERE qr.SESSION_ID = ?
       AND qr.SCORE = 1
       AND q.QUESTION_TYPE = 'LIKERT'
     ORDER BY q.QUESTION_ORDER`,
    [sessionId]
  );

  if (lowScoreRows.length === 0) return;

  const contextRows = await query<SessionContextRow>(
    `SELECT s.SITE_MANAGER_NAME, s.SITE_MANAGER_EMAIL,
            sess.PATIENT_NAME, sess.PATIENT_ID,
            st.STAGE_NAME, u.DISPLAY_NAME AS CONCIERGE_NAME,
            sess.COMPLETED_AT, sess.STARTED_AT
     FROM ${FB}.SESSIONS sess
     JOIN ${FB}.SITES s   ON s.SITE_ID   = sess.SITE_ID
     JOIN ${FB}.STAGES st ON st.STAGE_ID = sess.STAGE_ID
     JOIN ${FB}.USERS u   ON u.USER_ID   = sess.USER_ID
     WHERE sess.SESSION_ID = ?`,
    [sessionId]
  );

  if (!contextRows.length) {
    console.warn('[low-score-alert] could not find session context for SESSION_ID', sessionId);
    return;
  }

  const ctx = contextRows[0];

  if (!ctx.SITE_MANAGER_EMAIL) {
    console.warn('[low-score-alert] no site manager email configured for SESSION_ID', sessionId);
    await query(
      `INSERT INTO ${FB}.NOTIFICATIONS
         (NOTIFICATION_TYPE, SESSION_ID, RECIPIENT_EMAIL, SUBJECT, STATUS, ERROR_MESSAGE, CREATED_AT)
       VALUES (?, ?, 'unknown', ?, 'FAILED', ?, CURRENT_TIMESTAMP())`,
      [
        'LOW_SCORE_ALERT',
        String(sessionId),
        `Low score alert: ${ctx.PATIENT_NAME} - ${ctx.STAGE_NAME}`,
        'No site manager email configured for site',
      ]
    );
    return;
  }

  const appUrl = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
  const completedAt = fmtDateTime(ctx.COMPLETED_AT ?? ctx.STARTED_AT);
  const subject = `Low score alert: ${ctx.PATIENT_NAME} - ${ctx.STAGE_NAME}`;

  const bulletItems = lowScoreRows.map((r) => `
    <li style="margin-bottom: 10px;">
      <strong style="color: #222;">${escapeHtml(r.QUESTION_TEXT)}</strong><br>
      <span style="color: #555; font-size: 14px;">
        KPI: ${escapeHtml(r.KPI_MEASURE ?? '-')} &bull; CQC domain: ${escapeHtml(r.CQC_DOMAIN ?? '-')}
      </span>
    </li>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:8px;padding:32px;border:1px solid #e0e0e0;">
    <p style="color:#333;font-size:16px;margin-top:0;">Hi ${escapeHtml(ctx.SITE_MANAGER_NAME ?? 'Site Manager')},</p>
    <p style="color:#333;font-size:16px;">
      A feedback session for <strong>${escapeHtml(ctx.PATIENT_NAME)}</strong> at the
      <strong>${escapeHtml(ctx.STAGE_NAME)}</strong> stage scored 1 (the lowest rating) on
      the following question(s):
    </p>
    <ul style="color:#333;font-size:15px;line-height:1.7;padding-left:20px;">
      ${bulletItems}
    </ul>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />
    <p style="color:#666;font-size:14px;line-height:1.8;margin:0;">
      Submitted by: ${escapeHtml(ctx.CONCIERGE_NAME)}<br>
      Completed: ${completedAt}<br>
      <a href="${appUrl}/patient/${ctx.PATIENT_ID}" style="color:#ff6b2b;">View patient journey</a>
    </p>
    <p style="color:#999;font-size:13px;margin-top:24px;margin-bottom:0;">Active Neuro Feedback System</p>
  </div>
</body>
</html>`;

  await sendEmail({
    to: ctx.SITE_MANAGER_EMAIL,
    subject,
    html,
    notificationType: 'LOW_SCORE_ALERT',
    sessionId: String(sessionId),
  });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
