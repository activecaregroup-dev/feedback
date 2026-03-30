import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Credentials from 'next-auth/providers/credentials';
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

// TODO: remove before go-live
const DEV_USER: AppUser = {
  id: 'dev',
  name: 'Dev User',
  email: 'dev@local',
  oid: 'dev-oid',
  siteId: 1,
  siteName: 'Nottingham',
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
    // TODO: remove before go-live
    Credentials({
      credentials: { password: {} },
      authorize(credentials) {
        if (credentials.password === 'dev2026') {
          return { id: DEV_USER.id, name: DEV_USER.name, email: DEV_USER.email };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'credentials' && user) {
        // TODO: remove before go-live
        token.devUser = true;
      } else if (account && profile) {
        token.oid = (profile as Record<string, unknown>).oid as string;
      }
      return token;
    },
    async session({ session, token }) {
      // TODO: remove before go-live
      if (token.devUser) {
        session.user = DEV_USER;
        return session;
      }

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
