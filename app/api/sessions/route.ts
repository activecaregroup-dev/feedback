import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json();
  const { patientId, patientName, stageId, whoPresent, checklistResponses, questionResponses, comments, actions } = body;

  // Insert session and retrieve the generated SESSION_ID
  const sessionRows = await query<{ SESSION_ID: number }>(
    `INSERT INTO SESSIONS (PATIENT_ID, PATIENT_NAME, STAGE_ID, USER_ID, SITE_ID, STATUS, WHO_PRESENT, STARTED_AT)
     VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, CURRENT_TIMESTAMP())
     RETURNING SESSION_ID`,
    [patientId, patientName, stageId, session.user.id, session.user.siteId, whoPresent]
  );

  const sessionId = sessionRows[0].SESSION_ID;

  // Checklist responses
  if (checklistResponses?.length) {
    for (const r of checklistResponses) {
      await query(
        `INSERT INTO CHECKLIST_RESPONSES (SESSION_ID, ITEM_ID, IS_CHECKED, CREATED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP())`,
        [sessionId, r.itemId, r.checked]
      );
    }
  }

  // Question responses
  if (questionResponses?.length) {
    for (const r of questionResponses) {
      await query(
        `INSERT INTO QUESTION_RESPONSES (SESSION_ID, QUESTION_ID, SCORE, CREATED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP())`,
        [sessionId, r.questionId, r.score]
      );
    }
  }

  // Comments
  if (comments?.trim()) {
    await query(
      `INSERT INTO COMMENTS (SESSION_ID, COMMENT_TEXT, CREATED_AT) VALUES (?, ?, CURRENT_TIMESTAMP())`,
      [sessionId, comments.trim()]
    );
  }

  // Actions
  if (actions?.length) {
    for (const a of actions) {
      await query(
        `INSERT INTO ACTIONS (SESSION_ID, USER_ID, PATIENT_ID, ACTION_TEXT, STATUS, CREATED_AT) VALUES (?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP())`,
        [sessionId, session.user.id, patientId, a.text]
      );
    }
  }

  return NextResponse.json({ sessionId }, { status: 201 });
}
