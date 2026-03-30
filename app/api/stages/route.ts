import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const rows = await query<{ STAGE_ID: number; NAME: string; DISPLAY_ORDER: number }>(
    `SELECT STAGE_ID, NAME, DISPLAY_ORDER
     FROM STAGES
     ORDER BY DISPLAY_ORDER`
  );

  return NextResponse.json(rows);
}
