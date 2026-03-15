import { prisma, Prisma, InterviewStatus } from '@vibe/database';
import { OpenCodeManager } from '@vibe/opencode-manager';
import { nanoid } from 'nanoid';
import type { CreateInterviewDto } from '@vibe/shared-types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let openCodeManagerInstance: OpenCodeManager | null = null;
let isInitialized = false;

export async function getOpenCodeManager(): Promise<OpenCodeManager> {
  if (!openCodeManagerInstance) {
    openCodeManagerInstance = new OpenCodeManager(process.env.OPENCODE_PATH || 'opencode');
  }

  if (!isInitialized) {
    // Initialize with active ports from database
    const activeInterviews = await prisma.interview.findMany({
      where: {
        status: InterviewStatus.IN_PROGRESS,
        port: { not: null }
      },
      select: { port: true }
    });

    const activePorts = activeInterviews
      .map(i => i.port)
      .filter((port): port is number => port !== null);

    openCodeManagerInstance.initializeWithActivePorts(activePorts);
    isInitialized = true;
  }

  return openCodeManagerInstance;
}

type InterviewWithRelations = Prisma.InterviewGetPayload<{
  include: { candidate: true; problem: true }
}>;

// 递归复制目录的辅助函数
function copyDirectorySync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export async function createInterview(
  data: CreateInterviewDto,
  organizationId: string,
  interviewerId?: string
): Promise<InterviewWithRelations> {
  const token = nanoid(16);

  // 获取 Problem 以访问 workDirTemplate
  const problem = await prisma.problem.findUnique({
    where: { id: data.problemId }
  });

  if (!problem) {
    throw new Error('Problem not found');
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: data.candidateId }
  });

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  // 创建面试专属工作目录
  const interviewsBaseDir = path.join(os.homedir(), '.local', 'share', 'vibe-interviews');
  const interviewWorkDir = path.join(interviewsBaseDir, token);

  // 复制模板目录到面试目录
  try {
    copyDirectorySync(problem.workDirTemplate, interviewWorkDir);
  } catch (error) {
    console.error('Failed to copy work directory:', error);
    throw new Error('Failed to prepare interview workspace');
  }

  // 创建快照
  const candidateSnapshot = {
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone
  };

  const problemSnapshot = {
    title: problem.title,
    description: problem.description,
    requirements: problem.requirements,
    duration: problem.duration,
    difficulty: problem.difficulty,
    roleTrack: problem.roleTrack,
    language: problem.language
  };

  const evaluationCriteriaSnapshot = problem.scoringCriteria as any;

  const interview = await prisma.interview.create({
    data: {
      candidateId: data.candidateId,
      problemId: data.problemId,
      token,
      duration: data.duration,
      status: InterviewStatus.PENDING,
      workDir: interviewWorkDir,
      organizationId,
      interviewerId,
      candidateSnapshot: candidateSnapshot as any,
      problemSnapshot: problemSnapshot as any,
      evaluationCriteriaSnapshot,
      aiEvaluationStatus: 'pending'
    },
    include: {
      candidate: true,
      problem: true
    }
  });

  return interview;
}

export async function startInterview(token: string): Promise<InterviewWithRelations> {
  const interview = await prisma.interview.findUnique({
    where: { token },
    include: { problem: true, candidate: true }
  });

  if (!interview || interview.status !== InterviewStatus.PENDING) {
    throw new Error('Invalid interview');
  }

  // 使用面试专属的 workDir（在 createInterview 时已设置）
  const workDir = interview.workDir;

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error('Interview workspace not found');
  }

  const manager = await getOpenCodeManager();

  try {
    const { port, processId, dataDir } = await manager.startInstance(interview.id, workDir);

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + interview.duration * 60000);

    return await prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: InterviewStatus.IN_PROGRESS,
        startTime,
        endTime,
        port,
        processId,
        dataDir,
        healthStatus: 'healthy',
        lastHealthCheck: startTime
      },
      include: {
        candidate: true,
        problem: true
      }
    });
  } catch (error) {
    await prisma.interview.update({
      where: { id: interview.id },
      data: {
        healthStatus: 'unhealthy',
        processError: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    throw error;
  }
}

export async function getInterviewByToken(token: string): Promise<InterviewWithRelations | null> {
  return await prisma.interview.findUnique({
    where: { token },
    include: {
      candidate: true,
      problem: true
    }
  });
}
