import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { actionId } = await params;
    const { emailedTo } = await request.json();

    if (!emailedTo?.trim()) {
      return NextResponse.json({ error: 'emailedTo required' }, { status: 400 });
    }

    await query(
      `INSERT INTO ${FB}.ACTION_EMAILS (ACTION_ID, EMAILED_TO, EMAILED_BY, EMAILED_AT)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP())`,
      [actionId, emailedTo.trim(), session.user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/actions/[actionId]/email]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
