import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN } from '@/lib/snowflake';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{
      PATIENT_ID: number;
      PATIENT_NAME: string;
      QUESTION_TEXT: string;
      STAGE_NAME: string;
      SCORE: number;
      CREATED_AT: string;
    }>(
      `SELECT
         p.PATIENT_ID,
         p.PATIENT_NAME,
         q.QUESTION_TEXT,
         st.STAGE_NAME,
         qr.SCORE,
         qr.CREATED_AT
       FROM QUESTION_RESPONSES qr
       JOIN SESSIONS s ON s.SESSION_ID = qr.SESSION_ID
       JOIN QUESTIONS q ON q.QUESTION_ID = qr.QUESTION_ID
       JOIN STAGES st ON st.STAGE_ID = s.STAGE_ID
       JOIN ${CN}.PATIENT p ON p.PATIENT_ID = s.PATIENT_ID
       JOIN PATIENT_ASSIGNMENTS pa ON pa.PATIENT_ID = s.PATIENT_ID
       WHERE qr.SCORE <= 2
         AND qr.CREATED_AT >= DATEADD(day, -30, CURRENT_TIMESTAMP())
         AND pa.USER_ID = ?
         AND pa.IS_ACTIVE = TRUE
       ORDER BY qr.CREATED_AT DESC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/dashboard/flagged]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
