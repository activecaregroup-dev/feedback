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
      QUICK_ACTION_ID: number;
      ACTION_TEXT: string;
      STATUS: string;
      CREATED_AT: string;
      CREATED_BY_NAME: string;
    }>(
      `SELECT qa.QUICK_ACTION_ID, qa.ACTION_TEXT, qa.STATUS, qa.CREATED_AT,
              u.DISPLAY_NAME AS CREATED_BY_NAME
       FROM ${FB}.QUICK_ACTIONS qa
       JOIN ${FB}.USERS u ON u.USER_ID = qa.CREATED_BY_USER_ID
       WHERE qa.PATIENT_ID = ?
         AND qa.STATUS = 'OPEN'
       ORDER BY qa.CREATED_AT DESC`,
      [patientId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/patients/[patientId]/quick-actions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
