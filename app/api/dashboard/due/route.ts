import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN } from '@/lib/snowflake';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{
      PATIENT_ID: number;
      PATIENT_NAME: string;
      NEXT_STAGE_ID: number;
      NEXT_STAGE_NAME: string;
      NEXT_STAGE_ORDER: number;
    }>(
      `WITH assigned_patients AS (
         SELECT pa.PATIENT_ID
         FROM PATIENT_ASSIGNMENTS pa
         WHERE pa.USER_ID = ?
           AND pa.IS_ACTIVE = TRUE
       ),
       max_completed AS (
         SELECT
           ap.PATIENT_ID,
           COALESCE(MAX(st.STAGE_ORDER), 0) AS MAX_ORDER
         FROM assigned_patients ap
         LEFT JOIN SESSIONS s ON s.PATIENT_ID = ap.PATIENT_ID AND s.STATUS = 'COMPLETED'
         LEFT JOIN STAGES st ON st.STAGE_ID = s.STAGE_ID
         GROUP BY ap.PATIENT_ID
       ),
       next_stage AS (
         SELECT
           mc.PATIENT_ID,
           mc.MAX_ORDER,
           st.STAGE_ID   AS NEXT_STAGE_ID,
           st.STAGE_NAME AS NEXT_STAGE_NAME,
           st.STAGE_ORDER AS NEXT_STAGE_ORDER
         FROM max_completed mc
         JOIN STAGES st ON st.STAGE_ORDER = mc.MAX_ORDER + 1
       )
       SELECT
         ns.PATIENT_ID,
         p.PATIENT_NAME,
         ns.NEXT_STAGE_ID,
         ns.NEXT_STAGE_NAME,
         ns.NEXT_STAGE_ORDER
       FROM next_stage ns
       JOIN ${CN}.PATIENT p ON p.PATIENT_ID = ns.PATIENT_ID
       WHERE NOT EXISTS (
         SELECT 1 FROM SESSIONS s2
         WHERE s2.PATIENT_ID = ns.PATIENT_ID
           AND s2.STAGE_ID = ns.NEXT_STAGE_ID
       )
       ORDER BY ns.NEXT_STAGE_ORDER, p.PATIENT_NAME`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/dashboard/due]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
