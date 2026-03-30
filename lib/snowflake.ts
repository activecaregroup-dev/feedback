import snowflake from 'snowflake-sdk';

// Singleton connection pool
let connection: snowflake.Connection | null = null;

function getConnection(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    if (connection) {
      return resolve(connection);
    }

    const privateKey = process.env.SNOWFLAKE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey) {
      return reject(new Error('SNOWFLAKE_PRIVATE_KEY is not set'));
    }

    const conn = snowflake.createConnection({
      account: 'ik70694.uk-south.azure',
      username: 'FEEDBACK_SVC',
      authenticator: 'SNOWFLAKE_JWT',
      privateKey,
      warehouse: 'COMPUTE_WH',
      database: 'DATAOPS_DEV',
      schema: 'COLLECTION_FEEDBACK',
    });

    conn.connect((err, conn) => {
      if (err) return reject(err);
      connection = conn;
      resolve(conn);
    });
  });
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: snowflake.Binds = []
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
