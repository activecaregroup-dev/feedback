import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await request.json();
    const { patientId, stageId } = body as { patientId: number; stageId: number };

    if (!patientId || !stageId) {
      return NextResponse.json({ error: 'patientId and stageId required' }, { status: 400 });
    }

    // Only the assigned concierge for this patient may skip a stage
    const assignmentRows = await query<{ CNT: number }>(
      `SELECT COUNT(1) AS CNT
       FROM ${FB}.PATIENT_ASSIGNMENTS
       WHERE PATIENT_ID = ? AND USER_ID = ? AND IS_ACTIVE = TRUE`,
      [patientId, session.user.id]
    );
    if (!assignmentRows[0]?.CNT) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If a session already exists for this patient + stage, return 409 with the existing SESSION_ID
    const existingRows = await query<{ SESSION_ID: number }>(
      `SELECT SESSION_ID FROM ${FB}.SESSIONS
       WHERE PATIENT_ID = ? AND STAGE_ID = ?
       LIMIT 1`,
      [patientId, stageId]
    );
    if (existingRows.length) {
      return NextResponse.json({ sessionId: existingRows[0].SESSION_ID }, { status: 409 });
    }

    // Look up patient name
    const patientRows = await query<{ PATIENT_NAME: string }>(
      `SELECT PATIENT_NAME FROM ${CN}.PATIENT WHERE PATIENT_ID = ? LIMIT 1`,
      [patientId]
    );
    const patientName = patientRows[0]?.PATIENT_NAME ?? '';

    // Insert SKIPPED session - STARTED_AT and COMPLETED_AT both set to skip time
    await query(
      `INSERT INTO ${FB}.SESSIONS
         (PATIENT_ID, PATIENT_NAME, STAGE_ID, USER_ID, SITE_ID, STATUS, WHO_PRESENT, STARTED_AT, COMPLETED_AT)
       VALUES (?, ?, ?, ?, ?, 'SKIPPED', NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`,
      [patientId, patientName, stageId, session.user.id, session.user.siteId]
    );

    const sessionRows = await query<{ SESSION_ID: number }>(
      `SELECT MAX(SESSION_ID) AS SESSION_ID
       FROM ${FB}.SESSIONS
       WHERE USER_ID = ? AND PATIENT_ID = ? AND STAGE_ID = ?`,
      [session.user.id, patientId, stageId]
    );

    return NextResponse.json({ sessionId: sessionRows[0].SESSION_ID }, { status: 200 });
  } catch (err) {
    console.error('[/api/sessions/skip]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
