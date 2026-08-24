import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth';
import { getDb, users } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { Video, LayoutDashboard, Sparkles, LogOut, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { CreditMeter } from '@/components/CreditMeter';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in');

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const email = user?.email ?? session.user.email ?? '';

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Left nav rail */}
      <aside className="w-56 shrink-0 border-r border-line bg-cream px-3 py-6 flex flex-col">
        <div className="mb-8 px-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-panel bg-accent text-white">
            <Video size={16} />
          </div>
          <span className="font-display font-bold text-ink">Shorts Studio</span>
        </div>

        <nav className="flex-1 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-panel px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            <LayoutDashboard size={16} /> Dashboard
          </Link>
          <Link
            href="/generate"
            className="flex items-center gap-2 rounded-panel px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            <Sparkles size={16} /> New video
          </Link>
          <Link
            href="/characters"
            className="flex items-center gap-2 rounded-panel px-3 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            <UserCircle2 size={16} /> Characters
          </Link>
        </nav>

        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/sign-in' });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-panel px-3 py-2 text-sm font-medium text-muted hover:bg-paper hover:text-ink"
          >
            <LogOut size={16} /> Sign out
          </button>
        </form>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line bg-paper px-6">
          <div className="text-sm font-medium text-muted">Dashboard</div>
          <div className="flex items-center gap-3">
            <CreditMeter />
            <span className="text-sm text-muted">{email}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 font-display text-sm font-bold text-accent">
              {email.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
