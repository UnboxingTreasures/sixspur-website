// middleware.ts
// Temporary password gate for /admin while the site is live but not yet
// ready for general dissemination. Scoped ONLY to /admin/* -- the public
// site (donors, adopters, everyone else) is completely unaffected.
//
// Uses standard HTTP Basic Auth (the browser's native login popup) rather
// than a custom login page, since this is meant to be quick and temporary
// -- swap for real Cognito-based auth when that's ready (see project notes,
// Section 13/14 pending items).
//
// Credentials come from Amplify environment variables, never hardcoded
// into this file. This runs server-side only (middleware never ships to
// the browser bundle), so no NEXT_PUBLIC_ prefix is needed or wanted here.

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Six Spur Admin"' },
  });
}

export function middleware(request: NextRequest) {
  // If the password env var isn't set (e.g. someone forgot to configure it
  // in Amplify), fail CLOSED rather than open -- better to accidentally
  // lock everyone out (including yourself, obviously noticeable) than to
  // accidentally leave /admin fully public because of a missing env var.
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set -- blocking all /admin access until it is configured.');
    return unauthorized();
  }

  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorized();
  }

  const base64Credentials = authHeader.slice('Basic '.length);
  let decoded: string;
  try {
    decoded = atob(base64Credentials);
  } catch {
    return unauthorized();
  }

  const separatorIndex = decoded.indexOf(':');
  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
