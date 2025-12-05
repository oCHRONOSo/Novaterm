import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const TOKEN_NAME = 'app_token';
const MAX_AGE_DAYS = 90;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signToken(payload: object) {
  return jwt.sign(payload, getSecret(), { expiresIn: `${MAX_AGE_DAYS}d` });
}

export function verifyToken(token: string) {
  return jwt.verify(token, getSecret()) as { id: number; email: string };
}

function cookieSettings(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSeconds,
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(TOKEN_NAME, token, cookieSettings(MAX_AGE_DAYS * 24 * 60 * 60));
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(TOKEN_NAME, '', cookieSettings(0));
}

export async function getTokenFromCookies() {
  const store = await cookies();
  const token = store.get(TOKEN_NAME)?.value;
  return token ?? null;
}

