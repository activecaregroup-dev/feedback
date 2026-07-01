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
      COMMENT_ID: number;
      COMMENT_TEXT: string;
      COMMENT_TYPE: string;
      CREATED_AT: string;
      STAGE_NAME: string;
    }>(
      `SELECT c.COMMENT_ID, c.COMMENT_TEXT, c.COMMENT_TYPE, c.CREATED_AT,
              st.STAGE_NAME
       FROM ${FB}.COMMENTS c
       JOIN ${FB}.SESSIONS sess ON sess.SESSION_ID = c.SESSION_ID
       JOIN ${FB}.STAGES st     ON st.STAGE_ID = sess.STAGE_ID
       WHERE sess.PATIENT_ID = ?
       ORDER BY c.CREATED_AT DESC`,
      [patientId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/patients/[patientId]/comments]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
