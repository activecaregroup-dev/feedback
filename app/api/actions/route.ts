import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, CN, FB } from '@/lib/snowflake';

// Outstanding actions for the current user's site
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const rows = await query<{
      ACTION_ID: number;
      SESSION_ID: number;
      ACTION_TEXT: string;
      STATUS: string;
      CREATED_AT: string;
      PATIENT_NAME: string;
      ASSIGNED_TO: string | null;
      LAST_EMAILED_TO: string | null;
      LAST_EMAILED_AT: string | null;
    }>(
      `SELECT
         a.ACTION_ID,
         a.SESSION_ID,
         a.ACTION_TEXT,
         a.STATUS,
         a.CREATED_AT,
         a.PATIENT_ID,
         p.PATIENT_NAME,
         a.ASSIGNED_TO,
         le.EMAILED_TO   AS LAST_EMAILED_TO,
         le.EMAILED_AT   AS LAST_EMAILED_AT
       FROM ${FB}.ACTIONS a
       JOIN ${FB}.SESSIONS s ON s.SESSION_ID = a.SESSION_ID
       JOIN ${CN}.PATIENT p ON p.PATIENT_ID = a.PATIENT_ID
       JOIN ${FB}.PATIENT_ASSIGNMENTS pa
         ON pa.PATIENT_ID = a.PATIENT_ID
        AND pa.USER_ID = ?
        AND pa.IS_ACTIVE = TRUE
       LEFT JOIN (
         SELECT ACTION_ID, EMAILED_TO, EMAILED_AT,
                ROW_NUMBER() OVER (PARTITION BY ACTION_ID ORDER BY EMAILED_AT DESC) AS rn
         FROM ${FB}.ACTION_EMAILS
       ) le ON le.ACTION_ID = a.ACTION_ID AND le.rn = 1
       WHERE a.COMPLETED_AT IS NULL
       ORDER BY a.CREATED_AT DESC`,
      [session.user.id]
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[/api/actions GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { actionId, assignedTo, actionText, complete } = await request.json();

    if (complete) {
      await query(
        `UPDATE ${FB}.ACTIONS a
         SET a.COMPLETED_AT = CURRENT_TIMESTAMP(), a.STATUS = 'COMPLETE'
         WHERE a.ACTION_ID = ?
           AND EXISTS (
             SELECT 1 FROM ${FB}.PATIENT_ASSIGNMENTS pa
             WHERE pa.PATIENT_ID = a.PATIENT_ID
               AND pa.USER_ID = ?
               AND pa.IS_ACTIVE = TRUE
           )`,
        [actionId, session.user.id]
      );
    } else if (assignedTo !== undefined) {
      await query(
        `UPDATE ${FB}.ACTIONS a
         SET a.ASSIGNED_TO = ?
         WHERE a.ACTION_ID = ?
           AND EXISTS (
             SELECT 1 FROM ${FB}.PATIENT_ASSIGNMENTS pa
             WHERE pa.PATIENT_ID = a.PATIENT_ID
               AND pa.USER_ID = ?
               AND pa.IS_ACTIVE = TRUE
           )`,
        [assignedTo?.trim() || null, actionId, session.user.id]
      );
    } else if (actionText !== undefined) {
      const trimmed = actionText?.trim();
      if (trimmed) {
        await query(
          `UPDATE ${FB}.ACTIONS a
           SET a.ACTION_TEXT = ?
           WHERE a.ACTION_ID = ?
             AND EXISTS (
               SELECT 1 FROM ${FB}.PATIENT_ASSIGNMENTS pa
               WHERE pa.PATIENT_ID = a.PATIENT_ID
                 AND pa.USER_ID = ?
                 AND pa.IS_ACTIVE = TRUE
             )`,
          [trimmed, actionId, session.user.id]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/actions PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
