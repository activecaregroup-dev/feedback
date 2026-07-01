import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ quickActionId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { quickActionId } = await params;

    // Any concierge at the same site can complete - SITE_ID check enforces this
    await query(
      `UPDATE ${FB}.QUICK_ACTIONS
       SET STATUS = 'COMPLETE',
           COMPLETED_AT = CURRENT_TIMESTAMP(),
           COMPLETED_BY_USER_ID = ?
       WHERE QUICK_ACTION_ID = ?
         AND SITE_ID = ?
         AND STATUS = 'OPEN'`,
      [session.user.id, quickActionId, session.user.siteId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/quick-actions/[quickActionId] PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
