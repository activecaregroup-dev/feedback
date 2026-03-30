import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId } = await req.json();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    await query(
      `UPDATE ${FB}.PATIENT_ASSIGNMENTS
       SET IS_ACTIVE = FALSE
       WHERE PATIENT_ID = ? AND IS_ACTIVE = TRUE`,
      [patientId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/patients/unassign]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
