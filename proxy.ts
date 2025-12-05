import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
const protectedPaths = ['/app'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path),
  );

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get('app_token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
  // Skip JWT verification in proxy (edge runtime) to avoid crypto/env issues.
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};

