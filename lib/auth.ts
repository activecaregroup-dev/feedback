import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from '@/auth.config';
import { query } from '@/lib/snowflake';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  emailVerified: null;
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
  id: '101',
  name: 'Dev User',
  email: 'dev@local',
  emailVerified: null,
  oid: 'dev-oid',
  siteId: 1,
  siteName: 'Nottingham',
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Node-only providers (Snowflake + bcrypt) live here, not in auth.config.ts,
  // so they never get bundled into the edge middleware.
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!password) return null;

        // TODO: remove before go-live — shared dev shortcut (no username)
        if (!username && password === 'dev2026') {
          return { id: 'dev', name: 'Dev User', email: 'dev@local', devUser: true };
        }
        if (!username) return null;

        // Username + password against the USERS table (bcrypt hash).
        const rows = await query<{
          AZURE_AD_OID: string;
          EMAIL: string;
          DISPLAY_NAME: string;
          PASSWORD_HASH: string | null;
          IS_ACTIVE: boolean;
        }>(
          `SELECT AZURE_AD_OID, EMAIL, DISPLAY_NAME, PASSWORD_HASH, IS_ACTIVE
           FROM USERS
           WHERE LOWER(USERNAME) = LOWER(?)
           LIMIT 1`,
          [username]
        );

        const row = rows[0];
        if (!row || !row.IS_ACTIVE || !row.PASSWORD_HASH) return null;
        if (!(await bcrypt.compare(password, row.PASSWORD_HASH))) return null;

        // Carry the OID so the session callback resolves the user (and site)
        // through the same path as Azure SSO.
        return {
          id: row.AZURE_AD_OID,
          name: row.DISPLAY_NAME,
          email: row.EMAIL,
          oid: row.AZURE_AD_OID,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'credentials' && user) {
        const u = user as { oid?: string; devUser?: boolean };
        if (u.devUser) {
          // TODO: remove before go-live
          token.devUser = true;
        } else if (u.oid) {
          // Real USERS-table login — resolve via the OID path below.
          token.oid = u.oid;
        }
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
        `SELECT u.USER_ID, u.DISPLAY_NAME, u.SITE_ID, s.SITE_NAME
         FROM USERS u
         JOIN SITES s ON s.SITE_ID = u.SITE_ID
         WHERE u.AZURE_AD_OID = ?
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
        emailVerified: null,
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
