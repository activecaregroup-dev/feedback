import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{
      ACTION_ID: number;
      ACTION_TEXT: string;
      COMPLETED_AT: string;
      PATIENT_ID: number;
      PATIENT_NAME: string;
      ASSIGNED_TO: string | null;
      STAGE_NAME: string;
      SESSION_ID: number;
    }>(
      `SELECT a.ACTION_ID, a.ACTION_TEXT, a.COMPLETED_AT,
              a.PATIENT_ID, p.PATIENT_NAME, a.ASSIGNED_TO,
              st.STAGE_NAME, a.SESSION_ID
       FROM ${FB}.ACTIONS a
       JOIN ${FB}.SESSIONS s  ON s.SESSION_ID  = a.SESSION_ID
       JOIN ${FB}.STAGES   st ON st.STAGE_ID   = s.STAGE_ID
       JOIN ${CN}.PATIENT  p  ON p.PATIENT_ID  = a.PATIENT_ID
       JOIN ${FB}.PATIENT_ASSIGNMENTS pa
         ON pa.PATIENT_ID = a.PATIENT_ID
        AND pa.USER_ID    = ?
        AND pa.IS_ACTIVE  = TRUE
       WHERE a.COMPLETED_AT IS NOT NULL
       ORDER BY p.PATIENT_NAME, a.COMPLETED_AT DESC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/actions/complete GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
