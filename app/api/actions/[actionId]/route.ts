import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { actionId } = await params;

    await query(
      `UPDATE ${FB}.ACTIONS a
       SET a.STATUS = 'COMPLETE', a.COMPLETED_AT = CURRENT_TIMESTAMP()
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
    console.error('[/api/actions/[actionId] PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
