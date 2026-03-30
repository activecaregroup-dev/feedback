import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId } = await req.json();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    // One-concierge rule: check for existing active assignment
    const existing = await query<{ ASSIGNMENT_ID: number }>(
      `SELECT ASSIGNMENT_ID
       FROM ${FB}.PATIENT_ASSIGNMENTS
       WHERE PATIENT_ID = ? AND IS_ACTIVE = TRUE
       LIMIT 1`,
      [patientId]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Patient already assigned' }, { status: 409 });
    }

    await query(
      `INSERT INTO ${FB}.PATIENT_ASSIGNMENTS (PATIENT_ID, USER_ID, ASSIGNED_AT, IS_ACTIVE)
       VALUES (?, ?, CURRENT_TIMESTAMP(), TRUE)`,
      [patientId, session.user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/patients/assign]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
