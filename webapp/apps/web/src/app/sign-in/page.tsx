'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function SignInForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useSearchParams();
  const callbackUrl = search.get('callbackUrl') ?? '/dashboard';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn('email', { email, redirect: false, callbackUrl });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-cream p-8 shadow-card">
        <div className="mb-6 text-center">
          <div className="font-display text-2xl font-bold text-ink">Shorts Studio</div>
          <p className="mt-1 text-sm text-muted">Sign in with a magic link</p>
        </div>

        {sent ? (
          <div className="rounded-panel border border-signal/40 bg-signal/10 p-4 text-sm text-ink">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-muted">
              We sent a magic link to <span className="font-mono">{email}</span>. On localhost it
              lands in MailHog at <span className="font-mono">localhost:8025</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@localhost"
                className="mt-1 w-full rounded-panel border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:opacity-60"
            >
              {pending ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// useSearchParams() must be inside a <Suspense> boundary for the static prerender.
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
