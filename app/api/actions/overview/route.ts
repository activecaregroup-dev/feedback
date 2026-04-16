import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const uid = session.user.id;

    // All assigned patients + their next due stage + ward dates
    const patients = await query<{
      PATIENT_ID: number;
      PATIENT_NAME: string;
      ADMISSION_DATE: string | null;
      PLANNED_DISCHARGE_DATE: string | null;
      NEXT_STAGE_NAME: string | null;
      NEXT_STAGE_ORDER: number | null;
    }>(
      `WITH assigned AS (
         SELECT DISTINCT pa.PATIENT_ID
         FROM ${FB}.PATIENT_ASSIGNMENTS pa
         WHERE pa.USER_ID = ? AND pa.IS_ACTIVE = TRUE
       ),
       max_done AS (
         SELECT a.PATIENT_ID, COALESCE(MAX(st.STAGE_ORDER), 0) AS MAX_ORDER
         FROM assigned a
         LEFT JOIN ${FB}.SESSIONS s  ON s.PATIENT_ID  = a.PATIENT_ID AND s.STATUS = 'COMPLETED'
         LEFT JOIN ${FB}.STAGES   st ON st.STAGE_ID   = s.STAGE_ID
         GROUP BY a.PATIENT_ID
       ),
       next_st AS (
         SELECT md.PATIENT_ID, st.STAGE_NAME AS NEXT_STAGE_NAME, st.STAGE_ORDER AS NEXT_STAGE_ORDER
         FROM max_done md
         LEFT JOIN ${FB}.STAGES st ON st.STAGE_ORDER = md.MAX_ORDER + 1
       ),
       ranked_ws AS (
         SELECT ws.PATIENT_ID, ws.ACTUAL_START_DTTM, ws.PLANNED_END_DTTM,
                ROW_NUMBER() OVER (PARTITION BY ws.PATIENT_ID ORDER BY ws.ACTUAL_START_DTTM DESC) AS rn
         FROM ${CN}.WARDSTAY ws
       )
       SELECT p.PATIENT_ID, p.PATIENT_NAME,
              rws.ACTUAL_START_DTTM AS ADMISSION_DATE,
              rws.PLANNED_END_DTTM  AS PLANNED_DISCHARGE_DATE,
              ns.NEXT_STAGE_NAME, ns.NEXT_STAGE_ORDER
       FROM assigned a
       JOIN ${CN}.PATIENT p    ON p.PATIENT_ID   = a.PATIENT_ID
       LEFT JOIN next_st  ns   ON ns.PATIENT_ID  = a.PATIENT_ID
       LEFT JOIN ranked_ws rws ON rws.PATIENT_ID = a.PATIENT_ID AND rws.rn = 1
       ORDER BY p.PATIENT_NAME`,
      [uid]
    );

    if (!patients.length) return NextResponse.json([]);

    // Deduplicate — guard against multiple assignment rows producing duplicate patient rows
    const uniquePatients = Array.from(new Map(patients.map((p) => [p.PATIENT_ID, p])).values());

    const patientIds = uniquePatients.map((p) => p.PATIENT_ID);

    // All actions (open + complete) for those patients
    const actions = await query<{
      ACTION_ID: number;
      PATIENT_ID: number;
      ACTION_TEXT: string;
      ASSIGNED_TO: string | null;
      STATUS: string;
      COMPLETED_AT: string | null;
      CREATED_AT: string;
      STAGE_NAME: string;
      SESSION_ID: number;
    }>(
      `SELECT a.ACTION_ID, a.PATIENT_ID, a.ACTION_TEXT, a.ASSIGNED_TO,
              a.STATUS, a.COMPLETED_AT, a.CREATED_AT, st.STAGE_NAME, a.SESSION_ID
       FROM ${FB}.ACTIONS a
       JOIN ${FB}.SESSIONS s  ON s.SESSION_ID = a.SESSION_ID
       JOIN ${FB}.STAGES   st ON st.STAGE_ID  = s.STAGE_ID
       WHERE a.PATIENT_ID IN (${patientIds.map(() => '?').join(',')})
       ORDER BY a.PATIENT_ID, a.COMPLETED_AT IS NULL DESC, a.CREATED_AT DESC`,
      patientIds
    );

    const actionsByPatient = new Map<number, typeof actions>();
    for (const a of actions) {
      if (!actionsByPatient.has(a.PATIENT_ID)) actionsByPatient.set(a.PATIENT_ID, []);
      actionsByPatient.get(a.PATIENT_ID)!.push(a);
    }

    const result = uniquePatients
      .map((p) => {
        const all = actionsByPatient.get(p.PATIENT_ID) ?? [];
        const openActions = all.filter((a) => a.STATUS !== 'COMPLETE');
        const completedActions = all.filter((a) => a.STATUS === 'COMPLETE');
        const latestAt = all[0]?.CREATED_AT ? new Date(all[0].CREATED_AT).getTime() : 0;
        return { ...p, openActions, completedActions, latestAt };
      })
      .filter((p) => p.openActions.length > 0 || p.completedActions.length > 0)
      .sort((a, b) => b.latestAt - a.latestAt);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/actions/overview]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
