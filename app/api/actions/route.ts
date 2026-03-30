import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

// Outstanding actions for the current user's site
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{
      ACTION_ID: number;
      SESSION_ID: number;
      ACTION_TEXT: string;
      STATUS: string;
      CREATED_AT: string;
      PATIENT_NAME: string;
    }>(
      `SELECT
         a.ACTION_ID,
         a.SESSION_ID,
         a.ACTION_TEXT,
         a.STATUS,
         a.CREATED_AT,
         a.PATIENT_ID,
         p.PATIENT_NAME
       FROM ${FB}.ACTIONS a
       JOIN ${FB}.SESSIONS s ON s.SESSION_ID = a.SESSION_ID
       JOIN ${CN}.PATIENT p ON p.PATIENT_ID = a.PATIENT_ID
       JOIN ${FB}.PATIENT_ASSIGNMENTS pa
         ON pa.PATIENT_ID = a.PATIENT_ID
        AND pa.USER_ID = ?
        AND pa.IS_ACTIVE = TRUE
       WHERE a.COMPLETED_AT IS NULL
       ORDER BY a.CREATED_AT DESC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/actions GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { actionId } = await request.json();
    await query(
      `UPDATE ${FB}.ACTIONS a
       SET a.COMPLETED_AT = CURRENT_TIMESTAMP(), a.STATUS = 'COMPLETED'
       WHERE a.ACTION_ID = ?
         AND EXISTS (
           SELECT 1 FROM ${FB}.PATIENT_ASSIGNMENTS pa
           WHERE pa.PATIENT_ID = a.PATIENT_ID
             AND pa.USER_ID = ?
             AND pa.IS_ACTIVE = TRUE
         )`,
      [actionId, session.user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/actions PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
