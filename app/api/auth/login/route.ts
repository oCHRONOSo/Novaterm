import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie, clearAuthCookie } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const response = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    clearAuthCookie(response);
    return response;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const response = NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    clearAuthCookie(response);
    return response;
  }

  const token = signToken({ id: user.id, email: user.email });
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  setAuthCookie(response, token);
  return response;
}

