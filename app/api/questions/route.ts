import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const stageId = searchParams.get('stageId');
  if (!stageId) return NextResponse.json({ error: 'stageId required' }, { status: 400 });

  const rows = await query<{
    QUESTION_ID: number;
    QUESTION_TEXT: string;
    DISPLAY_ORDER: number;
  }>(
    `SELECT QUESTION_ID, QUESTION_TEXT, DISPLAY_ORDER
     FROM QUESTIONS
     WHERE STAGE_ID = ?
     ORDER BY DISPLAY_ORDER`,
    [stageId]
  );

  return NextResponse.json(rows);
}
