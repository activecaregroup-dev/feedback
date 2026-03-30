import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{ STAGE_ID: number; STAGE_KEY: string; STAGE_NAME: string; STAGE_ORDER: number; REQUIRES_ADMISSION: boolean }>(
      `SELECT STAGE_ID, STAGE_KEY, STAGE_NAME, STAGE_ORDER, REQUIRES_ADMISSION
       FROM STAGES
       ORDER BY STAGE_ORDER`
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/stages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
