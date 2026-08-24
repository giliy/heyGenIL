import { NextResponse } from 'next/server';
import { listTemplateCards } from '@/lib/templates';

export async function GET() {
  // Route is behind middleware (auth required).
  const templates = listTemplateCards();
  return NextResponse.json({ templates });
}
