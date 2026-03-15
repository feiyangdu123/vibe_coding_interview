import { PrismaClient, UserRole } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Starting seed...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: 'default-org-id' },
    update: {},
    create: {
      id: 'default-org-id',
      name: 'Default Organization'
    }
  });

  console.log('Created organization:', org.name);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      email: 'admin@example.com',
      role: UserRole.ORG_ADMIN,
      organizationId: org.id
    }
  });

  console.log('Created admin user:', admin.username);

  // Create interviewer user
  const interviewer = await prisma.user.upsert({
    where: { username: 'interviewer' },
    update: {},
    create: {
      username: 'interviewer',
      passwordHash: hashPassword('interviewer123'),
      email: 'interviewer@example.com',
      role: UserRole.INTERVIEWER,
      organizationId: org.id
    }
  });

  console.log('Created interviewer user:', interviewer.username);

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
