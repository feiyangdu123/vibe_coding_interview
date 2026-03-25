import { prisma } from '@vibe/database';
import type { LoginDto, RegisterDto, SessionUser } from '@vibe/shared-types';
import { hashPassword, verifyPassword } from '../utils/password';
import { nanoid } from 'nanoid';
import { slugify } from '../utils/slug';
import { initializeOrganizationInterviewQuota } from './interview-quota-service';

const SESSION_DURATION_DAYS = 7;

function buildSessionUser(user: {
  id: string;
  username: string;
  email: string | null;
  role: any;
  organizationId: string | null;
  organization: {
    name: string;
    slug: string;
  } | null;
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    role: user.role,
    organizationId: user.organizationId || undefined,
    organizationName: user.organization?.name,
    organizationSlug: user.organization?.slug
  };
}

async function createSession(userId: string) {
  const sessionToken = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await prisma.authSession.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt
    }
  });

  return sessionToken;
}

async function getAvailableOrganizationSlug(baseValue: string): Promise<string> {
  const baseSlug = slugify(baseValue);
  const existing = await prisma.organization.findMany({
    where: {
      slug: {
        startsWith: baseSlug
      }
    },
    select: { slug: true }
  });

  const existingSlugs = new Set(existing.map((item) => item.slug));
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export async function login(dto: LoginDto): Promise<{ user: SessionUser; sessionToken: string } | null> {
  const user = await prisma.user.findUnique({
    where: { username: dto.username },
    include: { organization: true }
  });

  if (!user || !verifyPassword(dto.password, user.passwordHash)) {
    return null;
  }

  const sessionToken = await createSession(user.id);

  return {
    user: buildSessionUser(user),
    sessionToken
  };
}

export async function register(dto: RegisterDto): Promise<{ user: SessionUser; sessionToken: string }> {
  const passwordHash = hashPassword(dto.password);
  const organizationSlug = await getAvailableOrganizationSlug(dto.organizationSlug || dto.organizationName);

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: dto.organizationName,
        slug: organizationSlug
      }
    });

    await initializeOrganizationInterviewQuota(tx, organization.id);

    const user = await tx.user.create({
      data: {
        username: dto.username,
        passwordHash,
        email: dto.email || null,
        role: 'ORG_ADMIN',
        organizationId: organization.id
      },
      include: { organization: true }
    });

    const sessionToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await tx.authSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt
      }
    });

    return {
      user: buildSessionUser(user),
      sessionToken
    };
  });

  return result;
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
    organizationId: user.organizationId || undefined,
    organizationName: user.organization?.name,
    organizationSlug: user.organization?.slug
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
