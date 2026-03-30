import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId } = await params;

    // All stage definitions
    const stages = await query<{
      STAGE_ID: number;
      STAGE_NAME: string;
      STAGE_ORDER: number;
    }>(
      `SELECT STAGE_ID, STAGE_NAME, STAGE_ORDER
       FROM STAGES
       ORDER BY STAGE_ORDER`
    );

    // Sessions for this patient (completed only), with avg score
    const sessions = await query<{
      STAGE_ID: number;
      STARTED_AT: string;
      AVG_SCORE: number | null;
    }>(
      `SELECT
         s.STAGE_ID,
         s.STARTED_AT,
         AVG(qr.SCORE) AS AVG_SCORE
       FROM SESSIONS s
       LEFT JOIN QUESTION_RESPONSES qr ON qr.SESSION_ID = s.SESSION_ID
       WHERE s.PATIENT_ID = ?
         AND s.STATUS = 'COMPLETED'
       GROUP BY s.STAGE_ID, s.STARTED_AT`,
      [patientId]
    );

    const sessionByStage = new Map(sessions.map((s) => [s.STAGE_ID, s]));

    // Work out which stage is "due" (first stage with no completed session)
    let dueFound = false;
    const result = stages.map((stage) => {
      const completed = sessionByStage.get(stage.STAGE_ID);
      if (completed) {
        return {
          ...stage,
          status: 'complete' as const,
          startedAt: completed.STARTED_AT,
          avgScore: completed.AVG_SCORE,
        };
      }
      if (!dueFound) {
        dueFound = true;
        return { ...stage, status: 'due' as const, startedAt: null, avgScore: null };
      }
      return { ...stage, status: 'locked' as const, startedAt: null, avgScore: null };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/patients/[patientId]/stages]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
