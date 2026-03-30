import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId } = await params;

    // Patient basic info with most recent wardstay dates
    const patientRows = await query<{
      PATIENT_ID: number;
      PATIENT_NAME: string;
      DATE_OF_BIRTH: string;
      ADMISSION_DATE: string | null;
      PLANNED_DISCHARGE_DATE: string | null;
    }>(
      `WITH ranked_ws AS (
         SELECT ws.PATIENT_ID, ws.ACTUAL_START_DTTM, ws.PLANNED_END_DTTM,
                ROW_NUMBER() OVER (PARTITION BY ws.PATIENT_ID ORDER BY ws.ACTUAL_START_DTTM DESC) AS rn
         FROM ${CN}.WARDSTAY ws
       )
       SELECT p.PATIENT_ID, p.PATIENT_NAME, p.DATE_OF_BIRTH,
              rws.ACTUAL_START_DTTM AS ADMISSION_DATE,
              rws.PLANNED_END_DTTM  AS PLANNED_DISCHARGE_DATE
       FROM ${CN}.PATIENT p
       LEFT JOIN ranked_ws rws ON rws.PATIENT_ID = p.PATIENT_ID AND rws.rn = 1
       WHERE p.PATIENT_ID = ?`,
      [patientId]
    );

    if (!patientRows.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const patient = patientRows[0];

    // All stage definitions
    const stages = await query<{
      STAGE_ID: number;
      STAGE_NAME: string;
      STAGE_ORDER: number;
    }>(`SELECT STAGE_ID, STAGE_NAME, STAGE_ORDER FROM ${FB}.STAGES ORDER BY STAGE_ORDER`);

    // Completed sessions for this patient with avg score
    const sessions = await query<{
      SESSION_ID: number;
      STAGE_ID: number;
      STARTED_AT: string;
      WHO_PRESENT: string;
      AVG_SCORE: number | null;
    }>(
      `SELECT s.SESSION_ID, s.STAGE_ID, s.STARTED_AT, s.WHO_PRESENT,
              AVG(qr.SCORE) AS AVG_SCORE
       FROM ${FB}.SESSIONS s
       LEFT JOIN ${FB}.QUESTION_RESPONSES qr ON qr.SESSION_ID = s.SESSION_ID
       WHERE s.PATIENT_ID = ? AND s.STATUS = 'COMPLETED'
       GROUP BY s.SESSION_ID, s.STAGE_ID, s.STARTED_AT, s.WHO_PRESENT`,
      [patientId]
    );

    const sessionByStage = new Map(sessions.map((s) => [s.STAGE_ID, s]));
    const sessionIds = sessions.map((s) => s.SESSION_ID);

    // Question responses (with question text) for all completed sessions
    let questionResponses: {
      SESSION_ID: number;
      QUESTION_TEXT: string;
      SCORE: number;
      QUESTION_ORDER: number;
    }[] = [];
    if (sessionIds.length) {
      questionResponses = await query(
        `SELECT qr.SESSION_ID, q.QUESTION_TEXT, qr.SCORE, q.QUESTION_ORDER
         FROM ${FB}.QUESTION_RESPONSES qr
         JOIN ${FB}.QUESTIONS q ON q.QUESTION_ID = qr.QUESTION_ID
         WHERE qr.SESSION_ID IN (${sessionIds.map(() => '?').join(',')})
         ORDER BY qr.SESSION_ID, q.QUESTION_ORDER`,
        sessionIds
      );
    }

    // Comments for all completed sessions
    let comments: { SESSION_ID: number; COMMENT_TEXT: string }[] = [];
    if (sessionIds.length) {
      comments = await query(
        `SELECT SESSION_ID, COMMENT_TEXT
         FROM ${FB}.COMMENTS
         WHERE SESSION_ID IN (${sessionIds.map(() => '?').join(',')})`,
        sessionIds
      );
    }

    // Actions for this patient
    const actions = await query<{
      SESSION_ID: number;
      ACTION_TEXT: string;
      STATUS: string;
      COMPLETED_AT: string | null;
    }>(
      `SELECT SESSION_ID, ACTION_TEXT, STATUS, COMPLETED_AT
       FROM ${FB}.ACTIONS
       WHERE PATIENT_ID = ?
       ORDER BY CREATED_AT`,
      [patientId]
    );

    // Group by session
    const qBySession = new Map<number, typeof questionResponses>();
    for (const qr of questionResponses) {
      if (!qBySession.has(qr.SESSION_ID)) qBySession.set(qr.SESSION_ID, []);
      qBySession.get(qr.SESSION_ID)!.push(qr);
    }
    const cBySession = new Map<number, string[]>();
    for (const c of comments) {
      if (!cBySession.has(c.SESSION_ID)) cBySession.set(c.SESSION_ID, []);
      cBySession.get(c.SESSION_ID)!.push(c.COMMENT_TEXT);
    }
    const aBySession = new Map<number, typeof actions>();
    for (const a of actions) {
      if (!aBySession.has(a.SESSION_ID)) aBySession.set(a.SESSION_ID, []);
      aBySession.get(a.SESSION_ID)!.push(a);
    }

    // Build stage result
    let dueFound = false;
    const stageResult = stages.map((stage) => {
      const sess = sessionByStage.get(stage.STAGE_ID);
      if (sess) {
        return {
          ...stage,
          status: 'complete' as const,
          SESSION_ID: sess.SESSION_ID,
          COMPLETED_AT: sess.STARTED_AT,
          AVG_SCORE: sess.AVG_SCORE,
          WHO_PRESENT: sess.WHO_PRESENT,
          scores: qBySession.get(sess.SESSION_ID) ?? [],
          comments: cBySession.get(sess.SESSION_ID) ?? [],
          actions: aBySession.get(sess.SESSION_ID) ?? [],
        };
      }
      if (!dueFound) {
        dueFound = true;
        return {
          ...stage,
          status: 'due' as const,
          SESSION_ID: null,
          COMPLETED_AT: null,
          AVG_SCORE: null,
          WHO_PRESENT: null,
          scores: [],
          comments: [],
          actions: [],
        };
      }
      return {
        ...stage,
        status: 'locked' as const,
        SESSION_ID: null,
        COMPLETED_AT: null,
        AVG_SCORE: null,
        WHO_PRESENT: null,
        scores: [],
        comments: [],
        actions: [],
      };
    });

    return NextResponse.json({ patient, stages: stageResult });
  } catch (err) {
    console.error('[/api/patients/[patientId]/journey]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
