import type { Connection, Binds } from 'snowflake-sdk';

// Singleton connection — reused across requests in the same server process
let connection: Connection | null = null;

function normalisePrivateKey(raw: string): string {
  // Normalise line endings (handles CRLF from Windows editors)
  const pem = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detect key type from PEM header to give actionable errors
  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error(
      'SNOWFLAKE_PRIVATE_KEY is in PKCS#1 format. Convert it with:\n' +
      '  openssl pkcs8 -topk8 -inform PEM -in key.pem -nocrypt'
    );
  }
  if (pem.includes('BEGIN ENCRYPTED PRIVATE KEY')) {
    throw new Error(
      'SNOWFLAKE_PRIVATE_KEY is encrypted. Strip the passphrase with:\n' +
      '  openssl pkcs8 -topk8 -inform PEM -in key.p8 -nocrypt'
    );
  }
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error(
      'SNOWFLAKE_PRIVATE_KEY does not look like a valid PEM key. ' +
      'Expected -----BEGIN PRIVATE KEY----- (unencrypted PKCS#8).'
    );
  }

  return pem;
}

function getConnection(): Promise<Connection> {
  return new Promise((resolve, reject) => {
    if (connection) return resolve(connection);

    const rawKey = process.env.SNOWFLAKE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!rawKey) {
      return reject(new Error('SNOWFLAKE_PRIVATE_KEY is not set'));
    }

    let privateKey: string;
    try {
      privateKey = normalisePrivateKey(rawKey);
    } catch (err) {
      return reject(new Error(`Failed to parse SNOWFLAKE_PRIVATE_KEY: ${err}`));
    }

    // Runtime require keeps snowflake-sdk out of the bundler entirely.
    // The static `import type` above is erased at compile time, so the
    // bundler never tries to bundle the native Node.js modules inside the SDK.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const snowflake = require('snowflake-sdk') as typeof import('snowflake-sdk');

    const [feedbackDb, feedbackSchema] = (process.env.SNOWFLAKE_FEEDBACK_SCHEMA ?? 'DATAOPS_DEV.COLLECTION_FEEDBACK').split('.');

    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT ?? 'ik70694.uk-south.azure',
      username: process.env.SNOWFLAKE_USERNAME ?? 'FEEDBACK_SVC',
      authenticator: 'SNOWFLAKE_JWT',
      privateKey,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'COMPUTE_WH',
      database: feedbackDb,
      schema: feedbackSchema,
    });

    conn.connect((err, conn) => {
      if (err) return reject(err);
      connection = conn;
      resolve(conn);
    });
  });
}

// Schema prefixes for use in SQL across route handlers.
// Import these instead of hardcoding database/schema names.
export const FB = process.env.SNOWFLAKE_FEEDBACK_SCHEMA ?? 'DATAOPS_DEV.COLLECTION_FEEDBACK';
export const CN = process.env.SNOWFLAKE_CARENOTES_SCHEMA ?? 'DATAOPS_PROD.COLLECTION_CARENOTES';

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: Binds = []
): Promise<T[]> {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) return reject(err);
        resolve((rows ?? []) as T[]);
      },
    });
  });
}
