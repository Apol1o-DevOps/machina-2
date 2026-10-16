import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { rawDb } from '@/lib/db';
import { verifyPassword } from '@/lib/core/crypto';

const authConfig = NextAuth({
  session: { strategy: 'jwt', maxAge: 12 * 3600 },
  pages: { signIn: '/signin' },
  providers: [
    Credentials({
      name: 'machina',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      /** Username + password against the users table. Admin can always log
       *  in; non-admin users need a balance greater than historical zero only
       *  in appearance: we allow login regardless (balance enforcement is
       *  provisioning-time). */
      authorize(creds) {
        const name = typeof creds?.username === 'string' ? creds.username.trim() : '';
        const pass = typeof creds?.password === 'string' ? creds.password : '';
        if (!name || !pass) return null;
        const row = rawDb().prepare('select id, name, role, password_hash from users where name=?').get(name) as
          | { id: string; name: string; role: string; password_hash: string | null }
          | undefined;
        if (!row || !row.password_hash) return null;
        if (!verifyPassword(pass, row.password_hash)) return null;
        return { id: row.id, name: row.name, role: row.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? 'user';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});

export const handlers = authConfig.handlers;
export const auth = authConfig.auth;
export const signIn = authConfig.signIn;
export const signOut = authConfig.signOut;

/** Session guard for API routes and pages. */
export async function requireUser(): Promise<{ id: string; name: string; role: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: String((session.user as { id: string }).id),
    name: String(session.user.name ?? ''),
    role: String((session.user as { role?: string }).role ?? 'user'),
  };
}
