import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId } = await params;

    const rows = await query<{
      ACTION_ID: number;
      ACTION_TEXT: string;
      STATUS: string;
      CREATED_AT: string;
      ASSIGNED_TO: string | null;
      STAGE_NAME: string;
    }>(
      `SELECT a.ACTION_ID, a.ACTION_TEXT, a.STATUS, a.CREATED_AT, a.ASSIGNED_TO,
              st.STAGE_NAME
       FROM ${FB}.ACTIONS a
       JOIN ${FB}.SESSIONS sess ON sess.SESSION_ID = a.SESSION_ID
       JOIN ${FB}.STAGES st     ON st.STAGE_ID = sess.STAGE_ID
       WHERE a.PATIENT_ID = ?
         AND a.STATUS = 'OPEN'
       ORDER BY a.CREATED_AT DESC`,
      [patientId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/patients/[patientId]/actions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
