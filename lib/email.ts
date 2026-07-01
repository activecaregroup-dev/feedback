import { query, FB } from '@/lib/snowflake';

type NotificationType = 'LOW_SCORE_ALERT' | 'MARKETING_CASE_STUDY' | 'MARKETING_REVIEW';

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  notificationType: NotificationType;
  sessionId?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  notificationType,
  sessionId,
}: SendEmailArgs): Promise<{ ok: boolean; messageId?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS ?? 'feedback@activecaregroup.co.uk';

  if (!apiKey) {
    const msg = 'RESEND_API_KEY is not set';
    console.warn('[email]', msg);
    await writeNotification({ notificationType, sessionId, recipientEmail: to, subject, status: 'FAILED', errorMessage: msg });
    return { ok: false };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({ from, to, subject, html });

    if (error) {
      await writeNotification({ notificationType, sessionId, recipientEmail: to, subject, status: 'FAILED', errorMessage: error.message });
      return { ok: false };
    }

    await writeNotification({ notificationType, sessionId, recipientEmail: to, subject, status: 'SENT', resendMessageId: data?.id });
    return { ok: true, messageId: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email]', msg);
    try {
      await writeNotification({ notificationType, sessionId, recipientEmail: to, subject, status: 'FAILED', errorMessage: msg });
    } catch (dbErr) {
      console.error('[email] failed to write FAILED notification to Snowflake:', dbErr);
    }
    return { ok: false };
  }
}

async function writeNotification(args: {
  notificationType: string;
  sessionId?: string;
  recipientEmail: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  errorMessage?: string;
  resendMessageId?: string;
}) {
  await query(
    `INSERT INTO ${FB}.NOTIFICATIONS
       (NOTIFICATION_TYPE, SESSION_ID, RECIPIENT_EMAIL, SUBJECT, STATUS, ERROR_MESSAGE, RESEND_MESSAGE_ID, CREATED_AT)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
    [
      args.notificationType,
      args.sessionId ?? null,
      args.recipientEmail,
      args.subject,
      args.status,
      args.errorMessage ?? null,
      args.resendMessageId ?? null,
    ]
  );
}
