// src/app/api/revalidate/route.ts
// Called server-to-server by adminFarmAnimals (and future admin Lambdas)
// immediately after a successful write, so changes go live instantly
// instead of waiting out the page's normal ISR revalidate window.
//
// The secret is checked against REVALIDATE_SECRET in the Amplify
// environment. It's never sent to or exposed in the browser -- only the
// Lambda holds it, in its own environment variables, same handling as any
// other credential in this project.

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: 'paths must be a non-empty array' }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths });
}
