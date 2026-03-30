import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const stageId = searchParams.get('stageId');
  if (!stageId) return NextResponse.json({ error: 'stageId required' }, { status: 400 });

  const [prompts, checklist] = await Promise.all([
    query<{ PROMPT_ID: number; THEME: string; PROMPT_TEXT: string; PROMPT_ORDER: number }>(
      `SELECT PROMPT_ID, THEME, PROMPT_TEXT, PROMPT_ORDER
       FROM CONVERSATION_PROMPTS
       WHERE STAGE_ID = ?
       ORDER BY PROMPT_ORDER`,
      [stageId]
    ),
    query<{ ITEM_ID: number; ITEM_TEXT: string; ITEM_ORDER: number }>(
      `SELECT ITEM_ID, ITEM_TEXT, ITEM_ORDER
       FROM CHECKLIST_ITEMS
       WHERE STAGE_ID = ?
       ORDER BY ITEM_ORDER`,
      [stageId]
    ),
  ]);

  return NextResponse.json({ prompts, checklist });
}
