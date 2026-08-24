// POST /api/quotes — return the upfront credit quote for a project. PURE: validates the spec
// (from the request, falling back to the stored spec) and runs quoteSpec(). NEVER touches the
// ledger — reserving happens only at job submit (POST /api/jobs).
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, projects } from '@shorts/db';
import { eq } from 'drizzle-orm';
import { validateSpec, quoteSpec } from '@shorts/spec';
import { getBillingInfo } from '@/lib/billing-server';

const db = getDb();

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { projectId?: string; inputSpec?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, body.projectId) });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const specInput = body.inputSpec ?? project.specJson;
  const result = validateSpec(specInput);
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid spec', issues: result.error.issues }, { status: 400 });
  }

  const info = await getBillingInfo(session.user.id, db);
  const quote = quoteSpec(result.data, info.tier);
  return NextResponse.json(quote);
}
