// Auth.js v5 (next-auth@5.0.0-beta.28, hard-pinned) + Drizzle adapter.
// Default provider: the Email/Nodemailer provider pointed at MailHog SMTP (port 1025),
// so magic links land in http://localhost:8025 with NO external API key.
// (Resend is the documented fallback per R3 — only if this provider breaks on the beta.)
import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Email from 'next-auth/providers/email';
import { getDb, users, accounts, sessions, verificationTokens } from '@shorts/db';
import { eq } from 'drizzle-orm';

const db = getDb();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Email({
      // EMAIL_SERVER=smtp://localhost:1025 (MailHog), EMAIL_FROM=shorts@localhost
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM ?? 'shorts@localhost',
    }),
  ],
  session: { strategy: 'database' },
  pages: { signIn: '/sign-in' },
  callbacks: {
    // Expose the user id on the session so API routes can scope queries.
    async session({ session, user }) {
      if (user?.id) session.user.id = user.id;
      return session;
    },
  },
});

/** Convenience: the signed-in user id, or null. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}
