import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

// Outstanding actions for the current user's site
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const rows = await query<{
    ACTION_ID: number;
    SESSION_ID: number;
    ACTION_TEXT: string;
    ASSIGNED_TO: string;
    DUE_DATE: string;
    COMPLETED_AT: string | null;
    PATIENT_FULL_NAME: string;
  }>(
    `SELECT
       a.ACTION_ID,
       a.SESSION_ID,
       a.ACTION_TEXT,
       a.ASSIGNED_TO,
       a.DUE_DATE,
       a.COMPLETED_AT,
       p.FULL_NAME AS PATIENT_FULL_NAME
     FROM ACTIONS a
     JOIN SESSIONS s ON s.SESSION_ID = a.SESSION_ID
     JOIN DATAOPS_PROD.COLLECTION_CARENOTES.PATIENT p ON p.PATIENT_ID = s.PATIENT_ID
     WHERE s.SITE_ID = ?
       AND a.COMPLETED_AT IS NULL
     ORDER BY a.DUE_DATE ASC NULLS LAST`,
    [session.user.siteId]
  );

  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { actionId } = await request.json();
  await query(
    `UPDATE ACTIONS SET COMPLETED_AT = CURRENT_TIMESTAMP() WHERE ACTION_ID = ?`,
    [actionId]
  );

  return NextResponse.json({ ok: true });
}
