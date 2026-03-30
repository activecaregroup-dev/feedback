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
      ADMISSION_DATE: string;
      PLANNED_DISCHARGE_DATE: string | null;
    }>(
      `WITH latest_wardstay AS (
         SELECT
           ws.PATIENT_ID,
           ws.ACTUAL_START_DTTM,
           ws.PLANNED_END_DTTM,
           ws.LOCATION_ID,
           ROW_NUMBER() OVER (
             PARTITION BY ws.PATIENT_ID
             ORDER BY ws.ACTUAL_START_DTTM DESC
           ) AS rn
         FROM ${CN}.WARDSTAY ws
         WHERE ws.ACTUAL_END_DTTM IS NULL
       )
       SELECT
         p.PATIENT_ID,
         p.PATIENT_NAME,
         p.DATE_OF_BIRTH,
         lw.ACTUAL_START_DTTM  AS ADMISSION_DATE,
         lw.PLANNED_END_DTTM   AS PLANNED_DISCHARGE_DATE
       FROM ${CN}.PATIENT p
       JOIN latest_wardstay lw
         ON lw.PATIENT_ID = p.PATIENT_ID AND lw.rn = 1
       JOIN ${FB}.SITES s
         ON ARRAY_CONTAINS(lw.LOCATION_ID::VARIANT, s.CARENOTES_LOCATION_IDS)
       JOIN ${FB}.PATIENT_ASSIGNMENTS pa
         ON pa.PATIENT_ID = p.PATIENT_ID
       WHERE pa.USER_ID = ?
         AND pa.IS_ACTIVE = TRUE
         AND s.SITE_ID = ?
       ORDER BY p.PATIENT_NAME`,
      [session.user.id, session.user.siteId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/patients]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
