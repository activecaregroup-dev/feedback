import type { NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Credentials from 'next-auth/providers/credentials';

// Edge-safe config — no Node.js-only imports (no snowflake-sdk).
// Used by middleware. The full auth config (with Snowflake session callback)
// lives in lib/auth.ts and is used by API routes and server components.
export const authConfig: NextAuthConfig = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
    // TODO: remove before go-live
    Credentials({
      credentials: { password: {} },
      authorize(credentials) {
        if (credentials.password === 'dev2026') {
          return { id: 'dev', name: 'Dev User', email: 'dev@local' };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
  },
};
