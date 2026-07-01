import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, FB } from '@/lib/snowflake';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { patientId, actionText } = await request.json();

    if (!actionText?.trim()) {
      return NextResponse.json({ error: 'Action text required' }, { status: 400 });
    }

    await query(
      `INSERT INTO ${FB}.QUICK_ACTIONS
         (PATIENT_ID, SITE_ID, CREATED_BY_USER_ID, ACTION_TEXT, STATUS, CREATED_AT)
       VALUES (?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP())`,
      [patientId, session.user.siteId, session.user.id, actionText.trim()]
    );

    const rows = await query<{
      QUICK_ACTION_ID: number;
      ACTION_TEXT: string;
      STATUS: string;
      CREATED_AT: string;
      CREATED_BY_NAME: string;
    }>(
      `SELECT qa.QUICK_ACTION_ID, qa.ACTION_TEXT, qa.STATUS, qa.CREATED_AT,
              u.DISPLAY_NAME AS CREATED_BY_NAME
       FROM ${FB}.QUICK_ACTIONS qa
       JOIN ${FB}.USERS u ON u.USER_ID = qa.CREATED_BY_USER_ID
       WHERE qa.PATIENT_ID = ?
         AND qa.CREATED_BY_USER_ID = ?
         AND qa.STATUS = 'OPEN'
       ORDER BY qa.CREATED_AT DESC
       LIMIT 1`,
      [patientId, session.user.id]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('[/api/quick-actions POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
