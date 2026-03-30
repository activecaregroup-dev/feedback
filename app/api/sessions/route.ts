import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json();
  const { patientId, stageId, attendees, checklistResponses, questionResponses, comments, actions } = body;

  // Insert session
  const sessionRows = await query<{ SESSION_ID: number }>(
    `INSERT INTO SESSIONS (PATIENT_ID, STAGE_ID, CONDUCTED_BY, SITE_ID, ATTENDEES, CREATED_AT)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
     RETURNING SESSION_ID`,
    [patientId, stageId, session.user.id, session.user.siteId, attendees]
  );

  const sessionId = sessionRows[0].SESSION_ID;

  // Checklist responses
  if (checklistResponses?.length) {
    for (const r of checklistResponses) {
      await query(
        `INSERT INTO CHECKLIST_RESPONSES (SESSION_ID, ITEM_ID, CHECKED) VALUES (?, ?, ?)`,
        [sessionId, r.itemId, r.checked]
      );
    }
  }

  // Question responses
  if (questionResponses?.length) {
    for (const r of questionResponses) {
      await query(
        `INSERT INTO QUESTION_RESPONSES (SESSION_ID, QUESTION_ID, SCORE) VALUES (?, ?, ?)`,
        [sessionId, r.questionId, r.score]
      );
    }
  }

  // Comments
  if (comments?.trim()) {
    await query(
      `INSERT INTO COMMENTS (SESSION_ID, COMMENT_TEXT) VALUES (?, ?)`,
      [sessionId, comments.trim()]
    );
  }

  // Actions
  if (actions?.length) {
    for (const a of actions) {
      await query(
        `INSERT INTO ACTIONS (SESSION_ID, ACTION_TEXT, ASSIGNED_TO, DUE_DATE) VALUES (?, ?, ?, ?)`,
        [sessionId, a.text, a.assignedTo ?? null, a.dueDate ?? null]
      );
    }
  }

  return NextResponse.json({ sessionId }, { status: 201 });
}
