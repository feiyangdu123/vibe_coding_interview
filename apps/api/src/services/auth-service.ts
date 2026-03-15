import { prisma } from '@vibe/database';
import type { LoginDto, RegisterDto, SessionUser } from '@vibe/shared-types';
import { hashPassword, verifyPassword } from '../utils/password';
import { nanoid } from 'nanoid';

const SESSION_DURATION_DAYS = 7;

export async function login(dto: LoginDto): Promise<{ user: SessionUser; sessionToken: string } | null> {
  const user = await prisma.user.findUnique({
    where: { username: dto.username },
    include: { organization: true }
  });

  if (!user || !verifyPassword(dto.password, user.passwordHash)) {
    return null;
  }

  const sessionToken = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await prisma.authSession.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt
    }
  });

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name
  };

  return { user: sessionUser, sessionToken };
}

export async function register(dto: RegisterDto): Promise<SessionUser> {
  const passwordHash = hashPassword(dto.password);

  const user = await prisma.user.create({
    data: {
      username: dto.username,
      passwordHash,
      email: dto.email,
      role: dto.role,
      organizationId: dto.organizationId
    },
    include: { organization: true }
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name
  };
}

export async function logout(sessionToken: string): Promise<void> {
  await prisma.authSession.delete({
    where: { token: sessionToken }
  }).catch(() => {
    // Ignore if session doesn't exist
  });
}

export async function validateSession(sessionToken: string): Promise<SessionUser | null> {
  const session = await prisma.authSession.findUnique({
    where: { token: sessionToken },
    include: {
      user: {
        include: { organization: true }
      }
    }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.authSession.delete({ where: { id: session.id } });
    }
    return null;
  }

  const user = session.user as any;

  return {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name
  };
}

export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.authSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
}

