// Middleware — protects /dashboard and /api/*, EXCEPT:
//   /api/auth/*           (Auth.js catch-all must be public)
//   GET  /api/jobs/*      (dashboard polls job status; allow-by-id polling)
//   /api/health           (liveness)
// Everything else under /api and /dashboard requires a session.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Run middleware in the Node.js runtime (not Edge): our Auth.js config uses the
// Nodemailer Email provider + Drizzle/pg adapter, neither of which is Edge-safe.
export const runtime = 'nodejs';

const PUBLIC_API = [
  /^\/api\/auth\//,
  /^\/api\/health$/,
  // Stripe webhook is called by Stripe servers (no session) — verified by signature only.
  /^\/api\/stripe\/webhook$/,
];

export default auth((req) => {
  const { nextUrl, method } = req as NextRequest & { method: string };
  const path = nextUrl.pathname;
  const isAuthed = !!(req as { auth?: unknown }).auth;

  // Allow public API routes.
  if (PUBLIC_API.some((re) => re.test(path))) return NextResponse.next();

  // Allow GET /api/jobs/* (status polling by job id).
  if (method === 'GET' && /^\/api\/jobs\//.test(path)) return NextResponse.next();

  const isApi = path.startsWith('/api/');
  const isDashboard = path.startsWith('/dashboard');
  const isMedia = path.startsWith('/media/');

  if ((isApi || isDashboard || isMedia) && !isAuthed) {
    if (isApi || isMedia) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const signIn = new URL('/sign-in', nextUrl.origin);
    signIn.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/media/:path*'],
};
