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
      name: '智谱',
      slug: 'default-org'
    },
    create: {
      id: 'default-org-id',
      name: '智谱',
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

  // Create platform admin (no organization)
  const platformAdmin = await prisma.user.upsert({
    where: { username: 'platform-admin' },
    update: {},
    create: {
      username: 'platform-admin',
      passwordHash: hashPassword('platform123'),
      email: 'platform-admin@vibe-interview.com',
      role: UserRole.PLATFORM_ADMIN
    }
  });

  console.log('Created platform admin:', platformAdmin.username);

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
      title: '算法与建模模板',
      description: '实现并优化一个算法或建模问题，关注正确性、复杂度与边界处理。',
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
      problemType: 'ALGORITHM_MODELING' as const,
      difficulty: 'Medium',
      tags: ['algorithm', 'modeling', 'optimization'],
      scoringRubric: '重点关注候选人的算法建模、复杂度分析和边界条件处理能力。',
      isActive: true
    },
    {
      title: '功能开发模板',
      description: '根据需求完成一个完整功能的开发，包含前后端交互和基本测试。',
      requirements: `1. 按照需求完成核心功能开发
2. 确保前后端接口对接正确
3. 保持代码结构清晰
4. 在有限时间内优先完成主链路`,
      scoringCriteria: {
        functionality: 4,
        codeQuality: 3,
        communication: 3
      },
      workDirTemplate: 'templates/default',
      duration: 60,
      problemType: 'FEATURE_DEV' as const,
      difficulty: 'Medium',
      tags: ['feature', 'development', 'fullstack'],
      scoringRubric: '重点关注候选人需求理解、功能实现完整性和代码质量。',
      isActive: true
    },
    {
      title: '调试修复模板',
      description: '修复一个已有项目中的若干缺陷，定位问题根因并验证修复效果。',
      requirements: `1. 定位并修复核心缺陷
2. 验证修复效果
3. 检查是否引入新问题
4. 在有限时间内优先修复主链路问题`,
      scoringCriteria: {
        bugFixing: 4,
        rootCauseAnalysis: 3,
        verification: 3
      },
      workDirTemplate: 'templates/default',
      duration: 60,
      problemType: 'DEBUG_FIX' as const,
      difficulty: 'Medium',
      tags: ['debugging', 'bug-fix', 'troubleshooting'],
      scoringRubric: '重点关注候选人定位问题、分析根因和验证修复的能力。',
      isActive: true
    },
    {
      title: '数据处理与分析模板',
      description: '基于数据集完成数据清洗、统计分析和可视化洞察。',
      requirements: `1. 对原始数据进行清洗和预处理
2. 完成核心指标的统计计算
3. 生成关键趋势的可视化图表
4. 输出分析结论和建议`,
      scoringCriteria: {
        dataProcessing: 4,
        analysisDepth: 3,
        visualization: 3
      },
      workDirTemplate: 'templates/default',
      duration: 90,
      problemType: 'DATA_PROCESSING' as const,
      difficulty: 'Medium',
      tags: ['data-analysis', 'pandas', 'visualization'],
      scoringRubric: '重点关注候选人的数据处理流程、分析逻辑和结论表述能力。',
      isActive: true
    },
    {
      title: '智能体开发模板',
      description: '基于 LLM 或工具链构建一个智能体，完成特定任务的自动化处理。',
      requirements: `1. 设计智能体的架构和工具链
2. 实现核心的推理与工具调用流程
3. 处理异常情况和边界条件
4. 输出运行结果和关键决策说明`,
      scoringCriteria: {
        architectureDesign: 3,
        implementation: 4,
        robustness: 3
      },
      workDirTemplate: 'templates/default',
      duration: 120,
      problemType: 'AGENT_DEV' as const,
      difficulty: 'Hard',
      tags: ['agent', 'llm', 'automation'],
      scoringRubric: '重点关注候选人的智能体架构设计、工具链集成和异常处理能力。',
      isActive: true
    },
    {
      title: '迭代重构模板',
      description: '对已有代码进行重构或迭代升级，提升可维护性和性能。',
      requirements: `1. 分析现有代码的问题和改进点
2. 实施重构并保持功能不变
3. 确保重构后的代码通过已有测试
4. 说明重构思路和改进效果`,
      scoringCriteria: {
        analysisAbility: 4,
        refactoringQuality: 3,
        testVerification: 3
      },
      workDirTemplate: 'templates/default',
      duration: 75,
      problemType: 'ITERATION_REFACTOR' as const,
      difficulty: 'Medium',
      tags: ['refactoring', 'code-quality', 'iteration'],
      scoringRubric: '重点关注候选人的代码分析能力、重构方案合理性和验证完整性。',
      isActive: true
    },
    {
      title: '产品设计模板',
      description: '根据业务场景完成产品方案设计，包含需求分析、原型和技术方案。',
      requirements: `1. 分析业务需求和用户场景
2. 设计产品功能方案
3. 输出核心页面或流程原型
4. 给出技术选型和实现思路`,
      scoringCriteria: {
        requirementAnalysis: 4,
        solutionDesign: 3,
        technicalFeasibility: 3
      },
      workDirTemplate: 'templates/default',
      duration: 90,
      problemType: 'PRODUCT_DESIGN' as const,
      difficulty: 'Medium',
      tags: ['product', 'design', 'requirement'],
      scoringRubric: '重点关注候选人的需求分析、方案设计和技术可行性判断能力。',
      isActive: true
    }
  ];

  // Delete existing templates and recreate (slug removed, no unique field for upsert)
  await prisma.problemTemplate.deleteMany({});
  for (const templateData of templates) {
    const template = await prisma.problemTemplate.create({
      data: templateData
    });

    console.log('Created platform template:', template.title);
  }

  // Create default EvaluationCriteriaConfig for each problem type
  const evaluationConfigs = [
    {
      problemType: 'ALGORITHM_MODELING' as const,
      displayName: '算法与建模',
      description: '算法设计与建模相关题目的评估标准',
      dimensions: [
        { name: '算法正确性', maxScore: 5, description: '核心算法逻辑是否正确' },
        { name: '复杂度分析', maxScore: 3, description: '时间和空间复杂度是否合理' },
        { name: '代码质量', maxScore: 2, description: '代码结构、可读性和边界处理' }
      ]
    },
    {
      problemType: 'FEATURE_DEV' as const,
      displayName: '功能开发',
      description: '功能开发类题目的评估标准',
      dimensions: [
        { name: '功能完整性', maxScore: 4, description: '核心功能是否完整实现' },
        { name: '代码质量', maxScore: 3, description: '代码结构、可读性和工程规范' },
        { name: '沟通表达', maxScore: 3, description: '需求理解和沟通能力' }
      ]
    },
    {
      problemType: 'DEBUG_FIX' as const,
      displayName: '调试修复',
      description: '调试和修复缺陷类题目的评估标准',
      dimensions: [
        { name: '问题定位', maxScore: 4, description: '定位问题根因的能力' },
        { name: '修复方案', maxScore: 3, description: '修复方案的合理性和完整性' },
        { name: '验证能力', maxScore: 3, description: '验证修复效果和回归测试' }
      ]
    },
    {
      problemType: 'DATA_PROCESSING' as const,
      displayName: '数据处理与分析',
      description: '数据处理和分析相关题目的评估标准',
      dimensions: [
        { name: '数据处理', maxScore: 4, description: '数据清洗和预处理的合理性' },
        { name: '分析深度', maxScore: 3, description: '统计分析的深度和逻辑性' },
        { name: '可视化', maxScore: 3, description: '图表表达和数据洞察' }
      ]
    },
    {
      problemType: 'AGENT_DEV' as const,
      displayName: '智能体开发',
      description: '智能体和 AI 应用开发类题目的评估标准',
      dimensions: [
        { name: '架构设计', maxScore: 3, description: '智能体架构和工具链设计' },
        { name: '实现质量', maxScore: 4, description: '核心功能实现的完整性和正确性' },
        { name: '鲁棒性', maxScore: 3, description: '异常处理和边界情况覆盖' }
      ]
    },
    {
      problemType: 'ITERATION_REFACTOR' as const,
      displayName: '迭代重构',
      description: '代码重构和迭代升级类题目的评估标准',
      dimensions: [
        { name: '分析能力', maxScore: 4, description: '对现有代码问题的分析和识别' },
        { name: '重构质量', maxScore: 3, description: '重构方案的合理性和代码质量' },
        { name: '测试验证', maxScore: 3, description: '重构后的验证完整性' }
      ]
    },
    {
      problemType: 'PRODUCT_DESIGN' as const,
      displayName: '产品设计',
      description: '产品方案设计类题目的评估标准',
      dimensions: [
        { name: '需求分析', maxScore: 4, description: '业务需求和用户场景分析能力' },
        { name: '方案设计', maxScore: 3, description: '产品方案的完整性和可行性' },
        { name: '技术可行性', maxScore: 3, description: '技术选型和实现思路的合理性' }
      ]
    }
  ];

  for (const config of evaluationConfigs) {
    const result = await prisma.evaluationCriteriaConfig.upsert({
      where: { problemType: config.problemType },
      update: {
        displayName: config.displayName,
        description: config.description,
        dimensions: config.dimensions
      },
      create: {
        ...config,
        dimensions: config.dimensions
      }
    });

    console.log('Created evaluation config:', result.displayName);
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
