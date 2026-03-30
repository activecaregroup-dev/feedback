import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/snowflake';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const rows = await query<{
    PATIENT_ID: number;
    FULL_NAME: string;
    DATE_OF_BIRTH: string;
    WARD: string;
    BED: string;
  }>(
    `SELECT
       p.PATIENT_ID,
       p.FULL_NAME,
       p.DATE_OF_BIRTH,
       ws.LOCATION_NAME  AS WARD,
       ws.BED_CODE        AS BED
     FROM DATAOPS_PROD.COLLECTION_CARENOTES.PATIENT p
     JOIN DATAOPS_PROD.COLLECTION_CARENOTES.WARDSTAY ws
       ON ws.PATIENT_ID = p.PATIENT_ID
     JOIN DATAOPS_DEV.COLLECTION_FEEDBACK.SITES s
       ON s.CARENOTES_LOCATION_ID = ws.LOCATION_ID
     WHERE ws.ACTUAL_END_DTTM IS NULL
       AND s.SITE_ID = ?
     ORDER BY p.FULL_NAME`,
    [session.user.siteId]
  );

  return NextResponse.json(rows);
}
