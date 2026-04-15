import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { patientId, patientName, stageId, whoPresent, questionResponses, promptNotes, comments, actions } = body;

    // Insert session — Snowflake doesn't support RETURNING, so we query back immediately
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

    // Question responses
    if (questionResponses?.length) {
      for (const r of questionResponses) {
        await query(
          `INSERT INTO ${FB}.QUESTION_RESPONSES (SESSION_ID, QUESTION_ID, SCORE, NOTE, CREATED_AT) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP())`,
          [sessionId, r.questionId, r.score, r.note ?? null]
        );
      }
    }

    // Prompt notes
    if (promptNotes?.length) {
      for (const pn of promptNotes) {
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
      for (const a of actions) {
        await query(
          `INSERT INTO ${FB}.ACTIONS (SESSION_ID, USER_ID, PATIENT_ID, ACTION_TEXT, ASSIGNED_TO, STATUS, CREATED_AT) VALUES (?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP())`,
          [sessionId, session.user.id, patientId, a.text, a.assignedTo?.trim() || null]
        );
      }
    }

    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (err) {
    console.error('[/api/sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
