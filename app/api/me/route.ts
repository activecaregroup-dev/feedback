import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const { id, name, email, siteId, siteName } = session.user;
    return NextResponse.json({ id, name, email, siteId, siteName });
  } catch (err) {
    console.error('[/api/me]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
