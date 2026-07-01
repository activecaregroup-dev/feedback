import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId } = await params;
    const body = await request.json() as { navigatorName?: string; caseWorkerName?: string };

    const setClauses: string[] = [];
    const binds: (string | null)[] = [];

    if (body.navigatorName !== undefined) {
      setClauses.push('NAVIGATOR_NAME = ?');
      binds.push(body.navigatorName.trim() || null);
    }
    if (body.caseWorkerName !== undefined) {
      setClauses.push('CASE_WORKER_NAME = ?');
      binds.push(body.caseWorkerName.trim() || null);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    await query(
      `UPDATE ${FB}.PATIENT_ASSIGNMENTS
       SET ${setClauses.join(', ')}
       WHERE PATIENT_ID = ? AND IS_ACTIVE = TRUE`,
      [...binds, patientId]
    );

    const rows = await query<{ NAVIGATOR_NAME: string | null; CASE_WORKER_NAME: string | null }>(
      `SELECT NAVIGATOR_NAME, CASE_WORKER_NAME
       FROM ${FB}.PATIENT_ASSIGNMENTS
       WHERE PATIENT_ID = ? AND IS_ACTIVE = TRUE`,
      [patientId]
    );

    return NextResponse.json(rows[0] ?? { NAVIGATOR_NAME: null, CASE_WORKER_NAME: null });
  } catch (err) {
    console.error('[/api/patients/[patientId]/assignment PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
