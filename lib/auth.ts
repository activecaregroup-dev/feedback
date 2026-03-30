import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { query } from '@/lib/snowflake';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  oid: string;
  siteId: number;
  siteName: string;
}

declare module 'next-auth' {
  interface Session {
    user: AppUser;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Store OID from Azure AD profile on first sign-in
        token.oid = (profile as Record<string, unknown>).oid as string;
      }
      return token;
    },
    async session({ session, token }) {
      const oid = token.oid as string;
      if (!oid) return session;

      const rows = await query<{
        USER_ID: number;
        DISPLAY_NAME: string;
        SITE_ID: number;
        SITE_NAME: string;
      }>(
        `SELECT u.USER_ID, u.DISPLAY_NAME, u.SITE_ID, s.NAME AS SITE_NAME
         FROM USERS u
         JOIN SITES s ON s.SITE_ID = u.SITE_ID
         WHERE u.AZURE_OID = ?
         LIMIT 1`,
        [oid]
      );

      if (rows.length === 0) {
        throw new Error(`No user found for OID ${oid}`);
      }

      const row = rows[0];
      session.user = {
        id: String(row.USER_ID),
        name: row.DISPLAY_NAME,
        email: session.user.email ?? '',
        oid,
        siteId: row.SITE_ID,
        siteName: row.SITE_NAME,
      };

      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
