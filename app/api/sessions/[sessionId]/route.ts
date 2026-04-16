import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { sessionId } = await params;

    const sessionRows = await query<{
      SESSION_ID: number;
      PATIENT_ID: number;
      PATIENT_NAME: string;
      STAGE_NAME: string;
      STAGE_ID: number;
      STARTED_AT: string;
      WHO_PRESENT: string | null;
    }>(
      `SELECT s.SESSION_ID, s.PATIENT_ID, s.PATIENT_NAME, st.STAGE_NAME, st.STAGE_ID, s.STARTED_AT, s.WHO_PRESENT
       FROM ${FB}.SESSIONS s
       JOIN ${FB}.STAGES st ON st.STAGE_ID = s.STAGE_ID
       WHERE s.SESSION_ID = ?`,
      [sessionId]
    );

    if (!sessionRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const meta = sessionRows[0];

    const scores = await query<{
      QUESTION_TEXT: string;
      SCORE: number;
      NOTE: string | null;
      QUESTION_ORDER: number;
    }>(
      `SELECT q.QUESTION_TEXT, qr.SCORE, qr.NOTE, q.QUESTION_ORDER
       FROM ${FB}.QUESTION_RESPONSES qr
       JOIN ${FB}.QUESTIONS q ON q.QUESTION_ID = qr.QUESTION_ID
       WHERE qr.SESSION_ID = ?
       ORDER BY q.QUESTION_ORDER`,
      [sessionId]
    );

    const promptNotes = await query<{
      THEME: string | null;
      PROMPT_TEXT: string;
      NOTE_TEXT: string;
    }>(
      `SELECT cp.THEME, cp.PROMPT_TEXT, pn.NOTE_TEXT
       FROM ${FB}.PROMPT_NOTES pn
       JOIN ${FB}.CONVERSATION_PROMPTS cp ON cp.PROMPT_ID = pn.PROMPT_ID
       WHERE pn.SESSION_ID = ?
       ORDER BY cp.PROMPT_ORDER`,
      [sessionId]
    );

    const comments = await query<{ COMMENT_TEXT: string }>(
      `SELECT COMMENT_TEXT FROM ${FB}.COMMENTS WHERE SESSION_ID = ?`,
      [sessionId]
    );

    const actions = await query<{
      ACTION_TEXT: string;
      ASSIGNED_TO: string | null;
      STATUS: string;
    }>(
      `SELECT ACTION_TEXT, ASSIGNED_TO, STATUS
       FROM ${FB}.ACTIONS
       WHERE SESSION_ID = ?
       ORDER BY CREATED_AT`,
      [sessionId]
    );

    const allPrompts = await query<{
      PROMPT_ID: number;
      PROMPT_TEXT: string;
      THEME: string | null;
      PROMPT_ORDER: number;
    }>(
      `SELECT PROMPT_ID, PROMPT_TEXT, THEME, PROMPT_ORDER
       FROM ${FB}.CONVERSATION_PROMPTS
       WHERE STAGE_ID = ?
       ORDER BY PROMPT_ORDER`,
      [meta.STAGE_ID]
    );

    return NextResponse.json({ meta, scores, promptNotes, allPrompts, comments, actions });
  } catch (err) {
    console.error('[/api/sessions/[sessionId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
