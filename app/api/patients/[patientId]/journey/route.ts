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
      NAVIGATOR_NAME: string | null;
      CASE_WORKER_NAME: string | null;
      SITE_NAME: string | null;
      SITE_MANAGER_NAME: string | null;
    }>(
      `WITH ranked_ws AS (
         SELECT ws.PATIENT_ID, ws.ACTUAL_START_DTTM, ws.PLANNED_END_DTTM,
                ROW_NUMBER() OVER (PARTITION BY ws.PATIENT_ID ORDER BY ws.ACTUAL_START_DTTM DESC) AS rn
         FROM ${CN}.WARDSTAY ws
       )
       SELECT p.PATIENT_ID, p.PATIENT_NAME, p.DATE_OF_BIRTH,
              rws.ACTUAL_START_DTTM AS ADMISSION_DATE,
              rws.PLANNED_END_DTTM  AS PLANNED_DISCHARGE_DATE,
              pa.NAVIGATOR_NAME,
              pa.CASE_WORKER_NAME,
              s.SITE_NAME,
              s.SITE_MANAGER_NAME
       FROM ${CN}.PATIENT p
       LEFT JOIN ranked_ws rws ON rws.PATIENT_ID = p.PATIENT_ID AND rws.rn = 1
       LEFT JOIN ${FB}.PATIENT_ASSIGNMENTS pa ON pa.PATIENT_ID = p.PATIENT_ID AND pa.IS_ACTIVE = TRUE
       LEFT JOIN ${FB}.USERS u ON u.USER_ID = pa.USER_ID
       LEFT JOIN ${FB}.SITES s ON s.SITE_ID = u.SITE_ID
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

    // All sessions for this patient: COMPLETED and SKIPPED
    // SKIPPED sessions have no QUESTION_RESPONSES - exclude from score averages.
    // STATUS = 'COMPLETED' reporting filter must be applied in all score queries.
    const sessions = await query<{
      SESSION_ID: number;
      STAGE_ID: number;
      STARTED_AT: string;
      WHO_PRESENT: string | null;
      STATUS: string;
      AVG_SCORE: number | null;
    }>(
      `SELECT s.SESSION_ID, s.STAGE_ID, s.STARTED_AT, s.WHO_PRESENT, s.STATUS,
              AVG(qr.SCORE) AS AVG_SCORE
       FROM ${FB}.SESSIONS s
       LEFT JOIN ${FB}.QUESTION_RESPONSES qr ON qr.SESSION_ID = s.SESSION_ID
       WHERE s.PATIENT_ID = ? AND s.STATUS IN ('COMPLETED', 'SKIPPED')
       GROUP BY s.SESSION_ID, s.STAGE_ID, s.STARTED_AT, s.WHO_PRESENT, s.STATUS`,
      [patientId]
    );

    // Separate completed vs any-session maps
    const completedSessionByStage = new Map(
      sessions.filter((s) => s.STATUS === 'COMPLETED').map((s) => [s.STAGE_ID, s])
    );
    const sessionByStage = new Map(sessions.map((s) => [s.STAGE_ID, s]));

    // Only pull responses/notes/comments for COMPLETED sessions (SKIPPED have none)
    const completedSessionIds = sessions
      .filter((s) => s.STATUS === 'COMPLETED')
      .map((s) => s.SESSION_ID);

    // Question responses (with question text) for all completed sessions
    let questionResponses: {
      SESSION_ID: number;
      QUESTION_TEXT: string;
      SCORE: number;
      QUESTION_ORDER: number;
      NOTE: string | null;
    }[] = [];
    if (completedSessionIds.length) {
      questionResponses = await query(
        `SELECT qr.SESSION_ID, q.QUESTION_TEXT, qr.SCORE, q.QUESTION_ORDER, qr.NOTE
         FROM ${FB}.QUESTION_RESPONSES qr
         JOIN ${FB}.QUESTIONS q ON q.QUESTION_ID = qr.QUESTION_ID
         WHERE qr.SESSION_ID IN (${completedSessionIds.map(() => '?').join(',')})
         ORDER BY qr.SESSION_ID, q.QUESTION_ORDER`,
        completedSessionIds
      );
    }

    // Comments for all completed sessions
    let comments: { SESSION_ID: number; COMMENT_TEXT: string }[] = [];
    if (completedSessionIds.length) {
      comments = await query(
        `SELECT SESSION_ID, COMMENT_TEXT
         FROM ${FB}.COMMENTS
         WHERE SESSION_ID IN (${completedSessionIds.map(() => '?').join(',')})`,
        completedSessionIds
      );
    }

    // Prompt notes for all completed sessions
    let promptNotes: { SESSION_ID: number; PROMPT_ID: number; NOTE_TEXT: string; THEME: string | null; PROMPT_TEXT: string }[] = [];
    if (completedSessionIds.length) {
      promptNotes = await query(
        `SELECT pn.SESSION_ID, pn.PROMPT_ID, pn.NOTE_TEXT, cp.THEME, cp.PROMPT_TEXT
         FROM ${FB}.PROMPT_NOTES pn
         JOIN ${FB}.CONVERSATION_PROMPTS cp ON cp.PROMPT_ID = pn.PROMPT_ID
         WHERE pn.SESSION_ID IN (${completedSessionIds.map(() => '?').join(',')})
         ORDER BY pn.SESSION_ID, cp.PROMPT_ORDER`,
        completedSessionIds
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
    const pnBySession = new Map<number, typeof promptNotes>();
    for (const pn of promptNotes) {
      if (!pnBySession.has(pn.SESSION_ID)) pnBySession.set(pn.SESSION_ID, []);
      pnBySession.get(pn.SESSION_ID)!.push(pn);
    }

    // Highest STAGE_ORDER among stages that have any session (COMPLETED or SKIPPED).
    // Stages before this order with no session are "not_captured" (gap in history).
    // Stages at or after this order with no session are 'due' or 'locked'.
    const maxCoveredOrder = stages
      .filter((s) => sessionByStage.has(s.STAGE_ID))
      .reduce((max, s) => Math.max(max, s.STAGE_ORDER), 0);

    // Build stage result
    let dueFound = false;
    const stageResult = stages.map((stage) => {
      const completedSess = completedSessionByStage.get(stage.STAGE_ID);
      const anySess = sessionByStage.get(stage.STAGE_ID);
      const hasSession = anySess !== undefined;

      if (completedSess) {
        return {
          ...stage,
          status: 'complete' as const,
          hasSession: true,
          SESSION_ID: completedSess.SESSION_ID,
          COMPLETED_AT: completedSess.STARTED_AT,
          AVG_SCORE: completedSess.AVG_SCORE,
          WHO_PRESENT: completedSess.WHO_PRESENT,
          scores: qBySession.get(completedSess.SESSION_ID) ?? [],
          comments: cBySession.get(completedSess.SESSION_ID) ?? [],
          actions: aBySession.get(completedSess.SESSION_ID) ?? [],
          promptNotes: pnBySession.get(completedSess.SESSION_ID) ?? [],
        };
      }

      if (hasSession) {
        // SKIPPED session - counts as captured, advances the due pointer
        return {
          ...stage,
          status: 'skipped' as const,
          hasSession: true,
          SESSION_ID: anySess!.SESSION_ID,
          COMPLETED_AT: anySess!.STARTED_AT,
          AVG_SCORE: null,
          WHO_PRESENT: null,
          scores: [],
          comments: [],
          actions: [],
          promptNotes: [],
        };
      }

      // No session for this stage
      if (stage.STAGE_ORDER < maxCoveredOrder) {
        // Gap: a later stage has a session but this one does not - not captured
        return {
          ...stage,
          status: 'not_captured' as const,
          hasSession: false,
          SESSION_ID: null,
          COMPLETED_AT: null,
          AVG_SCORE: null,
          WHO_PRESENT: null,
          scores: [],
          comments: [],
          actions: [],
          promptNotes: [],
        };
      }

      if (!dueFound) {
        dueFound = true;
        return {
          ...stage,
          status: 'due' as const,
          hasSession: false,
          SESSION_ID: null,
          COMPLETED_AT: null,
          AVG_SCORE: null,
          WHO_PRESENT: null,
          scores: [],
          comments: [],
          actions: [],
          promptNotes: [],
        };
      }

      return {
        ...stage,
        status: 'locked' as const,
        hasSession: false,
        SESSION_ID: null,
        COMPLETED_AT: null,
        AVG_SCORE: null,
        WHO_PRESENT: null,
        scores: [],
        comments: [],
        actions: [],
        promptNotes: [],
      };
    });

    return NextResponse.json({ patient, stages: stageResult });
  } catch (err) {
    console.error('[/api/patients/[patientId]/journey]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
