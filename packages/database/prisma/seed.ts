import {
  PrismaClient,
  UserRole,
  InterviewQuotaLedgerAction,
  InterviewQuotaLedgerReason
} from '@prisma/client';
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
    update: {
      slug: 'default-org'
    },
    create: {
      id: 'default-org-id',
      name: 'Default Organization',
      slug: 'default-org'
    }
  });

  console.log('Created organization:', org.name);

  const quota = await prisma.organizationInterviewQuota.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id
    }
  });

  const existingGrantLedger = await prisma.interviewQuotaLedger.findFirst({
    where: {
      organizationQuotaId: quota.id,
      action: InterviewQuotaLedgerAction.GRANT,
      reason: InterviewQuotaLedgerReason.ORGANIZATION_CREATED
    }
  });

  if (!existingGrantLedger) {
    await prisma.interviewQuotaLedger.create({
      data: {
        organizationQuotaId: quota.id,
        action: InterviewQuotaLedgerAction.GRANT,
        reason: InterviewQuotaLedgerReason.ORGANIZATION_CREATED,
        deltaTotal: quota.totalGranted,
        totalAfter: quota.totalGranted,
        reservedAfter: quota.reservedCount,
        consumedAfter: quota.consumedCount,
        availableAfter: quota.totalGranted - quota.reservedCount - quota.consumedCount,
        metadata: { source: 'seed' }
      }
    });
  }

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

  const templates = [
    {
      slug: 'frontend-dashboard-debug',
      title: '前端仪表盘 Debug 模板',
      description: '修复一个已有前端仪表盘项目中的若干缺陷，并补齐核心交互。',
      requirements: `1. 修复数据列表渲染异常
2. 修复筛选状态不同步问题
3. 保持样式结构和现有目录组织
4. 在有限时间内优先完成主链路`,
      scoringCriteria: {
        bugFixing: 4,
        uxJudgment: 3,
        communication: 3
      },
      workDirTemplate: 'templates/default',
      duration: 60,
      problemType: 'CODING' as const,
      roleTrack: 'Frontend',
      difficulty: 'Medium',
      language: 'TypeScript',
      tags: ['frontend', 'debugging', 'react'],
      evaluationInstructionsText: '重点关注候选人定位问题、验证修复和沟通取舍的能力。',
      acceptanceCriteria: [
        '列表可正常加载和展示',
        '筛选条件变更后结果与 UI 保持一致',
        '不会引入明显的运行时错误'
      ],
      isActive: true
    },
    {
      slug: 'backend-order-api-debug',
      title: '后端订单接口 Debug 模板',
      description: '修复一个订单查询与创建接口中的数据一致性和鉴权问题，并补齐必要校验。',
      requirements: `1. 修复订单列表分页或筛选异常
2. 修复下单接口中的参数校验或幂等性问题
3. 检查鉴权与错误处理是否完整
4. 优先保证核心接口行为正确且可验证`,
      scoringCriteria: {
        apiCorrectness: 4,
        dataConsistency: 3,
        errorHandling: 3
      },
      workDirTemplate: 'templates/default',
      duration: 75,
      problemType: 'DEBUGGING' as const,
      roleTrack: 'Backend',
      difficulty: 'Medium',
      language: 'TypeScript',
      tags: ['backend', 'api', 'debugging', 'database'],
      evaluationInstructionsText: '重点关注候选人定位后端问题、设计修复方案以及验证接口正确性的能力。',
      acceptanceCriteria: [
        '核心订单接口可正常返回正确结果',
        '异常请求能返回合理错误信息',
        '修复后不会破坏已有主要业务流程'
      ],
      isActive: true
    },
    {
      slug: 'algorithm-scheduling-optimization',
      title: '算法调度优化模板',
      description: '实现并优化一个任务调度类算法问题，关注正确性、复杂度与边界处理。',
      requirements: `1. 完成题目要求的核心算法实现
2. 分析时间复杂度和空间复杂度
3. 处理边界输入和异常情况
4. 提供必要的自测样例说明`,
      scoringCriteria: {
        correctness: 5,
        complexity: 3,
        codeQuality: 2
      },
      workDirTemplate: 'templates/default',
      duration: 60,
      problemType: 'ALGORITHM' as const,
      roleTrack: 'Algorithm',
      difficulty: 'Medium',
      language: 'Python',
      tags: ['algorithm', 'optimization', 'scheduling'],
      evaluationInstructionsText: '重点关注候选人的算法建模、复杂度分析和边界条件处理能力。',
      acceptanceCriteria: [
        '在给定样例下输出结果正确',
        '能够说明核心算法思路与复杂度',
        '关键边界条件有覆盖'
      ],
      isActive: true
    },
    {
      slug: 'qa-regression-test-design',
      title: '测试回归用例设计模板',
      description: '围绕一个已有功能模块设计测试方案，补齐关键测试用例并识别回归风险。',
      requirements: `1. 根据需求和现有行为梳理测试点
2. 输出核心测试用例，覆盖正常流、异常流和边界场景
3. 识别高风险回归点并说明优先级
4. 在有限时间内突出最关键的测试判断`,
      scoringCriteria: {
        testCoverage: 4,
        riskAwareness: 3,
        clarity: 3
      },
      workDirTemplate: 'templates/default',
      duration: 45,
      problemType: 'CODING' as const,
      roleTrack: 'QA',
      difficulty: 'Medium',
      language: 'Markdown',
      tags: ['testing', 'qa', 'regression', 'test-case'],
      evaluationInstructionsText: '重点关注候选人测试设计完整性、风险意识和表达清晰度。',
      acceptanceCriteria: [
        '包含关键主流程和异常流程测试点',
        '能够明确说明高优先级回归风险',
        '测试方案结构清晰且可执行'
      ],
      isActive: true
    }
  ];

  for (const templateData of templates) {
    const template = await prisma.problemTemplate.upsert({
      where: { slug: templateData.slug },
      update: {
        isActive: true
      },
      create: templateData
    });

    console.log('Created platform template:', template.slug);
  }

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
