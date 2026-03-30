import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{
      PATIENT_ID: number;
      PATIENT_NAME: string;
      DATE_OF_BIRTH: string;
      ASSIGNMENT_ID: number | null;
      ASSIGNED_USER_ID: number | null;
      ASSIGNED_USER_NAME: string | null;
      NEXT_STAGE_ORDER: number | null;
    }>(
      `WITH site_patients AS (
         SELECT DISTINCT
           p.PATIENT_ID,
           p.PATIENT_NAME,
           p.DATE_OF_BIRTH,
           pa.ASSIGNMENT_ID,
           pa.USER_ID     AS ASSIGNED_USER_ID,
           u.DISPLAY_NAME AS ASSIGNED_USER_NAME
         FROM ${CN}.PATIENT p
         JOIN ${CN}.WARDSTAY ws
           ON ws.PATIENT_ID = p.PATIENT_ID
         JOIN ${FB}.SITES s
           ON ARRAY_CONTAINS(ws.LOCATION_ID::VARIANT, s.CARENOTES_LOCATION_IDS)
         LEFT JOIN ${FB}.PATIENT_ASSIGNMENTS pa
           ON pa.PATIENT_ID = p.PATIENT_ID AND pa.IS_ACTIVE = TRUE
         LEFT JOIN ${FB}.USERS u
           ON u.USER_ID = pa.USER_ID
         WHERE ws.ACTUAL_END_DTTM IS NULL
           AND s.SITE_ID = ?
       ),
       max_completed AS (
         SELECT
           sp.PATIENT_ID,
           COALESCE(MAX(st.STAGE_ORDER), 0) AS MAX_ORDER
         FROM site_patients sp
         LEFT JOIN ${FB}.SESSIONS sess
           ON sess.PATIENT_ID = sp.PATIENT_ID AND sess.STATUS = 'COMPLETED'
         LEFT JOIN ${FB}.STAGES st ON st.STAGE_ID = sess.STAGE_ID
         GROUP BY sp.PATIENT_ID
       )
       SELECT DISTINCT
         sp.PATIENT_ID,
         sp.PATIENT_NAME,
         sp.DATE_OF_BIRTH,
         sp.ASSIGNMENT_ID,
         sp.ASSIGNED_USER_ID,
         sp.ASSIGNED_USER_NAME,
         ns.STAGE_ORDER AS NEXT_STAGE_ORDER
       FROM site_patients sp
       JOIN max_completed mc ON mc.PATIENT_ID = sp.PATIENT_ID
       LEFT JOIN ${FB}.STAGES ns ON ns.STAGE_ORDER = mc.MAX_ORDER + 1
       ORDER BY sp.PATIENT_NAME`,
      [session.user.siteId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/patients/site]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
