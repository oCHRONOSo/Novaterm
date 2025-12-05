import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/encryption';

async function requireUser() {
  const token = await getTokenFromCookies();
  if (!token) throw new Error('unauthorized');
  return verifyToken(token);
}

export async function GET(req: Request) {
  try {
    const payload = await requireUser();
    const { searchParams } = new URL(req.url);
    const includePassword = searchParams.get('includePassword') === 'true';
    
    const connections = await prisma.connection.findMany({
      where: { userId: payload.id },
      orderBy: { lastConnection: 'desc' },
      take: 10,
      select: {
        id: true,
        ip: true,
        port: true,
        username: true,
        password: includePassword,
        lastConnection: true,
      },
    });
    
    // Decrypt passwords if included
    const decryptedConnections = connections.map((conn) => ({
      ...conn,
      password: includePassword && conn.password ? decrypt(conn.password) : undefined,
    }));
    
    return NextResponse.json({ connections: decryptedConnections });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await requireUser();
    const { ip, port, username, password } = await req.json();
    if (!ip || !port || !username) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    
    // Encrypt password before storing
    const encryptedPassword = password ? encrypt(password) : null;
    
    await prisma.connection.upsert({
      where: {
        ip_port_username_userId: {
          ip,
          port,
          username,
          userId: payload.id,
        },
      },
      update: {
        password: encryptedPassword,
        lastConnection: new Date(),
      },
      create: {
        ip,
        port,
        username,
        password: encryptedPassword,
        userId: payload.id,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

