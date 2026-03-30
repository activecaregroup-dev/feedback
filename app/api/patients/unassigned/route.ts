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
    }>(
      `SELECT DISTINCT
         p.PATIENT_ID,
         p.PATIENT_NAME,
         p.DATE_OF_BIRTH
       FROM ${CN}.PATIENT p
       JOIN ${CN}.WARDSTAY ws
         ON ws.PATIENT_ID = p.PATIENT_ID
       JOIN ${FB}.SITES s
         ON ARRAY_CONTAINS(ws.LOCATION_ID::VARIANT, s.CARENOTES_LOCATION_IDS)
       LEFT JOIN ${FB}.PATIENT_ASSIGNMENTS pa
         ON pa.PATIENT_ID = p.PATIENT_ID AND pa.IS_ACTIVE = TRUE
       WHERE ws.ACTUAL_END_DTTM IS NULL
         AND s.SITE_ID = ?
         AND pa.PATIENT_ID IS NULL
       ORDER BY p.PATIENT_NAME`,
      [session.user.siteId]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/patients/unassigned]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
