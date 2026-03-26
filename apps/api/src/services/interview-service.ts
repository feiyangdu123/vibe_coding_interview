import {
  prisma,
  Prisma,
  InterviewStatus,
  EndReason,
  InterviewEventType,
  InterviewQuotaLedgerReason,
  InterviewQuotaState
} from '@vibe/database';
import { OpenCodeManager } from '@vibe/opencode-manager';
import { nanoid } from 'nanoid';
import type { CreateInterviewDto, BatchCreateInterviewDto } from '@vibe/shared-types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { evaluateInterview } from './ai-evaluation-service';
import {
  getInterviewScheduleWindow,
  reserveQuotaForCreatedInterviews,
  settleInterviewQuota
} from './interview-quota-service';

let openCodeManagerInstance: OpenCodeManager | null = null;
let isInitialized = false;

const MAX_RESTART_ATTEMPTS = 3;

type PrismaTx = Prisma.TransactionClient;
type InterviewWithRelations = Prisma.InterviewGetPayload<{
  include: { candidate: true; problem: true }
}>;

type PreparedInterview = {
  token: string;
  workDir: string;
  candidateData: {
    name: string;
    email: string;
    phone?: string;
  };
};

type WorkspaceUrlInterview = {
  id: string;
  port: number | null | undefined;
  workDir: string | null | undefined;
};

type ExistingLaunchState = {
  port: number;
  processId: number;
  dataDir: string;
};

function getWebPublicUrlBase(): string {
  return (process.env.WEB_PUBLIC_URL || process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function parseScheduledStartAt(value: string): Date {
  const scheduledStartAt = new Date(value);

  if (Number.isNaN(scheduledStartAt.getTime())) {
    throw new Error('Invalid scheduled start time');
  }

  return scheduledStartAt;
}

function cleanupWorkDir(workDir: string | null | undefined) {
  if (!workDir || !fs.existsSync(workDir)) {
    return;
  }

  fs.rmSync(workDir, { recursive: true, force: true });
}

export async function getOpenCodeManager(): Promise<OpenCodeManager> {
  if (!openCodeManagerInstance) {
    openCodeManagerInstance = new OpenCodeManager(process.env.OPENCODE_PATH || 'opencode');
    openCodeManagerInstance.onInstanceCrash(handleOpenCodeCrash);
  }

  if (!isInitialized) {
    const activeInterviews = await prisma.interview.findMany({
      where: {
        OR: [
          { status: InterviewStatus.IN_PROGRESS, port: { not: null } },
          { status: InterviewStatus.PENDING, openCodeStatus: 'ready', port: { not: null } }
        ]
      },
      select: { port: true }
    });

    const activePorts = activeInterviews
      .map((interview) => interview.port)
      .filter((port): port is number => port !== null);

    openCodeManagerInstance.initializeWithActivePorts(activePorts);
    isInitialized = true;
  }

  return openCodeManagerInstance;
}

export async function getWorkspaceUrlForPort(port: number | null | undefined): Promise<string | undefined> {
  if (typeof port !== 'number') {
    return undefined;
  }

  const manager = await getOpenCodeManager();
  return manager.getWorkspaceUrl(port);
}

export async function getWorkspaceUrlForInterview(interview: WorkspaceUrlInterview): Promise<string | undefined> {
  if (typeof interview.port !== 'number' || !interview.workDir) {
    return undefined;
  }

  try {
    const manager = await getOpenCodeManager();
    const launchSession = await manager.ensureLaunchSession(interview.id, interview.port, interview.workDir);
    return launchSession.sessionUrl;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[Interview] Failed to resolve workspace URL for interview ${interview.id}: ${msg}`);
    return undefined;
  }
}

export async function withWorkspaceUrl<T extends WorkspaceUrlInterview>(
  interview: T
): Promise<T & { workspaceUrl?: string }> {
  const workspaceUrl = await getWorkspaceUrlForInterview(interview);
  return {
    ...interview,
    workspaceUrl
  };
}

async function resolveExistingLaunchState(
  manager: OpenCodeManager,
  interview: WorkspaceUrlInterview & {
    processId: number | null | undefined;
    dataDir: string | null | undefined;
  }
): Promise<ExistingLaunchState | undefined> {
  if (typeof interview.port !== 'number') {
    return undefined;
  }

  const instance = manager.getInstance(interview.id);
  if (instance) {
    return {
      port: instance.port,
      processId: instance.processId,
      dataDir: instance.dataDir
    };
  }

  if (!interview.workDir || typeof interview.processId !== 'number' || !interview.dataDir) {
    return undefined;
  }

  const isHealthy = await manager.checkHealth(interview.port);
  if (!isHealthy) {
    return undefined;
  }

  return {
    port: interview.port,
    processId: interview.processId,
    dataDir: interview.dataDir
  };
}

async function handleOpenCodeCrash(interviewId: string, port: number, restartCount: number) {
  console.log(`OpenCode crash detected for interview ${interviewId} (port ${port}, restartCount ${restartCount})`);

  try {
    const manager = await getOpenCodeManager();

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: { status: true, organizationId: true, workDir: true, dataDir: true }
    });

    if (!interview || interview.status !== InterviewStatus.IN_PROGRESS) {
      manager.releasePort(port);
      return;
    }

    if (restartCount >= MAX_RESTART_ATTEMPTS) {
      console.error(`Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached for interview ${interviewId}, voiding interview`);
      manager.releasePort(port);
      await voidInterviewForSystemError(interviewId, `OpenCode process crashed ${restartCount} times, max retries exceeded`);
      return;
    }

    // Mark as restarting
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        openCodeStatus: 'restarting',
        healthStatus: 'unhealthy',
        lastHealthCheck: new Date()
      }
    });

    // Log restart event
    await prisma.interviewEvent.create({
      data: {
        interviewId,
        eventType: InterviewEventType.SYSTEM_ERROR,
        metadata: { type: 'opencode_restart', attempt: restartCount + 1, port }
      }
    });

    // Get API key config for restart
    const apiKeyConfig = await prisma.organizationApiKeyConfig.findFirst({
      where: { organizationId: interview.organizationId, isSelected: true },
      select: { baseUrl: true, apiKey: true, modelId: true }
    });

    const result = await manager.restartInstance(
      interviewId,
      port,
      interview.workDir!,
      interview.dataDir!,
      apiKeyConfig && apiKeyConfig.modelId
        ? { baseUrl: apiKeyConfig.baseUrl, apiKey: apiKeyConfig.apiKey, modelId: apiKeyConfig.modelId }
        : undefined,
      restartCount + 1
    );

    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        processId: result.processId,
        openCodeStatus: 'ready',
        healthStatus: 'healthy',
        lastHealthCheck: new Date()
      }
    });

    console.log(`OpenCode restarted successfully for interview ${interviewId} on port ${port} (attempt ${restartCount + 1})`);
  } catch (error) {
    console.error(`Failed to restart OpenCode for interview ${interviewId}:`, error);

    try {
      const manager = await getOpenCodeManager();

      if (restartCount + 1 >= MAX_RESTART_ATTEMPTS) {
        manager.releasePort(port);
        await voidInterviewForSystemError(
          interviewId,
          `OpenCode restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } else {
        // Release port since restart failed — next crash will allocate new
        manager.releasePort(port);
        await prisma.interview.update({
          where: { id: interviewId },
          data: {
            openCodeStatus: 'failed',
            healthStatus: 'unhealthy',
            processError: error instanceof Error ? error.message : 'Restart failed'
          }
        });
      }
    } catch (innerError) {
      console.error(`Failed to handle restart failure for interview ${interviewId}:`, innerError);
    }
  }
}

async function startOpenCodeForInterview(interviewId: string, workDir: string, organizationId: string) {
  await prisma.interview.update({
    where: { id: interviewId },
    data: { openCodeStatus: 'starting' }
  });

  try {
    const manager = await getOpenCodeManager();

    const apiKeyConfig = await prisma.organizationApiKeyConfig.findFirst({
      where: { organizationId, isSelected: true },
      select: { baseUrl: true, apiKey: true, modelId: true }
    });

    const { port, processId, dataDir } = await manager.startInstance(
      interviewId,
      workDir,
      apiKeyConfig && apiKeyConfig.modelId
        ? { baseUrl: apiKeyConfig.baseUrl, apiKey: apiKeyConfig.apiKey, modelId: apiKeyConfig.modelId }
        : undefined
    );

    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        port,
        processId,
        dataDir,
        openCodeStatus: 'ready',
        healthStatus: 'healthy',
        lastHealthCheck: new Date()
      }
    });

    console.log(`OpenCode prewarmed for interview ${interviewId} on port ${port}`);
  } catch (error) {
    console.error(`Failed to prewarm OpenCode for interview ${interviewId}:`, error);
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        openCodeStatus: 'failed',
        openCodeError: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

async function upsertCandidateForOrganization(
  tx: PrismaTx,
  organizationId: string,
  candidate: { name: string; email: string; phone?: string }
) {
  return tx.candidate.upsert({
    where: {
      organizationId_email: {
        organizationId,
        email: candidate.email
      }
    },
    update: {
      name: candidate.name,
      phone: candidate.phone
    },
    create: {
      organizationId,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone
    }
  });
}

function copyDirectorySync(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    throw new Error(`Template directory not found: ${src}`);
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  const skipList = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.turbo',
    '.cache',
    'coverage',
    '.env',
    '.env.local',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock'
  ];

  for (const entry of entries) {
    if (skipList.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    try {
      if (entry.isDirectory()) {
        copyDirectorySync(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (error) {
      console.warn(`Failed to copy ${srcPath}:`, error instanceof Error ? error.message : error);
    }
  }
}

function prepareInterviewWorkspace(
  workDirTemplate: string,
  token: string,
  problem: { title: string; description: string; requirements: string }
) {
  const interviewsBaseDir = path.join(os.homedir(), '.local', 'share', 'vibe-interviews');
  const interviewWorkDir = path.join(interviewsBaseDir, token);

  // Resolve relative paths against project root
  const resolvedTemplate = path.isAbsolute(workDirTemplate)
    ? workDirTemplate
    : path.resolve(__dirname, '../../../../', workDirTemplate);

  copyDirectorySync(resolvedTemplate, interviewWorkDir);

  // Write problem description file
  const problemContent = `# ${problem.title}

## 题目描述

${problem.description}

## 题目要求

${problem.requirements}
`;
  fs.writeFileSync(path.join(interviewWorkDir, '题目与要求.md'), problemContent, 'utf-8');

  return interviewWorkDir;
}

function buildSnapshots(
  problem: {
    title: string;
    description: string;
    requirements: string;
    duration: number;
    difficulty?: string | null;
    scoringCriteria: Prisma.JsonValue;
    scoringRubric?: string | null;
  },
  candidate: {
    name: string;
    email: string;
    phone?: string | null;
  },
  positionName?: string
) {
  return {
    candidateSnapshot: {
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone
    },
    problemSnapshot: {
      title: problem.title,
      description: problem.description,
      requirements: problem.requirements,
      duration: problem.duration,
      difficulty: problem.difficulty,
      positionName
    },
    evaluationCriteriaSnapshot: {
      scoringCriteria: problem.scoringCriteria,
      scoringRubric: problem.scoringRubric
    }
  };
}

async function getProblemForOrganization(problemId: string, organizationId: string) {
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      organizationId,
      deletedAt: null
    }
  });

  if (!problem) {
    throw new Error('Problem not found');
  }

  return problem;
}

async function getInterviewerForOrganization(interviewerId: string, organizationId: string) {
  const interviewer = await prisma.user.findFirst({
    where: {
      id: interviewerId,
      organizationId
    },
    select: { id: true }
  });

  if (!interviewer) {
    throw new Error('Interviewer not found');
  }
}

async function getCandidateForOrganization(tx: PrismaTx, candidateId: string, organizationId: string) {
  const candidate = await tx.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId
    }
  });

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  return candidate;
}

async function finalizeInterview(
  {
    interviewId,
    organizationId,
    eventType,
    eventMetadata,
    interviewUpdate,
    quotaAction,
    quotaReason,
    createdById,
    triggerEvaluation = false
  }: {
    interviewId: string;
    organizationId: string;
    eventType: InterviewEventType;
    eventMetadata?: Prisma.InputJsonValue;
    interviewUpdate: Prisma.InterviewUpdateInput;
    quotaAction?: 'consume' | 'release';
    quotaReason?: InterviewQuotaLedgerReason;
    createdById?: string | null;
    triggerEvaluation?: boolean;
  }
): Promise<InterviewWithRelations> {
  const updatedInterview = await prisma.$transaction(async (tx) => {
    await tx.interviewEvent.create({
      data: {
        interviewId,
        eventType,
        metadata: eventMetadata
      }
    });

    await tx.interview.update({
      where: { id: interviewId },
      data: interviewUpdate
    });

    if (quotaAction && quotaReason) {
      await settleInterviewQuota(tx, {
        interviewId,
        organizationId,
        action: quotaAction,
        reason: quotaReason,
        createdById,
        metadata: eventMetadata
      });
    }

    return tx.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: {
        candidate: true,
        problem: true
      }
    });
  });

  if (triggerEvaluation) {
    evaluateInterview(interviewId).catch((error) => {
      console.error(`Failed to start evaluation for ${interviewId}:`, error);
    });
  }

  return updatedInterview;
}

export async function createInterview(
  data: CreateInterviewDto,
  organizationId: string,
  createdById: string
): Promise<InterviewWithRelations> {
  const scheduledStartAt = parseScheduledStartAt(data.scheduledStartAt);
  const { joinWindowOpensAt, joinDeadlineAt } = getInterviewScheduleWindow(scheduledStartAt);
  const interviewerId = data.interviewerId || createdById;
  const token = nanoid(16);
  const problem = await getProblemForOrganization(data.problemId, organizationId);
  await getInterviewerForOrganization(interviewerId, organizationId);

  const workDir = prepareInterviewWorkspace(problem.workDirTemplate, token, problem);

  try {
    const interview = await prisma.$transaction(async (tx) => {
      let candidateId = data.candidateId;

      if (data.newCandidate?.name && data.newCandidate.email) {
        const candidate = await upsertCandidateForOrganization(tx, organizationId, data.newCandidate);
        candidateId = candidate.id;
      }

      if (!candidateId) {
        throw new Error('Candidate ID is required');
      }

      const candidate = await getCandidateForOrganization(tx, candidateId, organizationId);
      const snapshots = buildSnapshots(problem, candidate, data.positionName);
      const now = new Date();

      const interview = await tx.interview.create({
        data: {
          candidateId,
          problemId: data.problemId,
          token,
          duration: data.duration,
          status: InterviewStatus.PENDING,
          scheduledStartAt,
          joinWindowOpensAt,
          joinDeadlineAt,
          workDir,
          organizationId,
          interviewerId,
          quotaState: InterviewQuotaState.RESERVED,
          quotaReservedAt: now,
          candidateSnapshot: snapshots.candidateSnapshot as Prisma.InputJsonValue,
          problemSnapshot: snapshots.problemSnapshot as Prisma.InputJsonValue,
          evaluationCriteriaSnapshot: snapshots.evaluationCriteriaSnapshot as Prisma.InputJsonValue,
          aiEvaluationStatus: 'pending'
        },
        include: {
          candidate: true,
          problem: true
        }
      });

      await reserveQuotaForCreatedInterviews(tx, organizationId, [interview.id], createdById);
      return interview;
    });

    // Fire-and-forget: async prewarm OpenCode
    startOpenCodeForInterview(interview.id, workDir, organizationId).catch(err => {
      console.error(`Failed to prewarm OpenCode for interview ${interview.id}:`, err);
    });

    return interview;
  } catch (error) {
    cleanupWorkDir(workDir);
    throw error;
  }
}

export async function createBatchInterviews(
  data: BatchCreateInterviewDto,
  organizationId: string,
  createdById: string
) {
  const scheduledStartAt = parseScheduledStartAt(data.scheduledStartAt);
  const { joinWindowOpensAt, joinDeadlineAt } = getInterviewScheduleWindow(scheduledStartAt);
  const interviewerId = data.interviewerId || createdById;
  const problem = await getProblemForOrganization(data.problemId, organizationId);
  await getInterviewerForOrganization(interviewerId, organizationId);

  const preparedInterviews: PreparedInterview[] = [];

  try {
    for (const candidateData of data.candidates) {
      const token = nanoid(16);
      preparedInterviews.push({
        token,
        workDir: prepareInterviewWorkspace(problem.workDirTemplate, token, problem),
        candidateData
      });
    }
  } catch (error) {
    for (const prepared of preparedInterviews) {
      cleanupWorkDir(prepared.workDir);
    }
    throw new Error('Failed to prepare interview workspace');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdInterviews: InterviewWithRelations[] = [];

      for (const prepared of preparedInterviews) {
        const candidate = await upsertCandidateForOrganization(
          tx,
          organizationId,
          prepared.candidateData
        );
        const snapshots = buildSnapshots(problem, candidate, data.positionName);
        const now = new Date();

        const interview = await tx.interview.create({
          data: {
            candidateId: candidate.id,
            problemId: data.problemId,
            token: prepared.token,
            duration: data.duration,
            status: InterviewStatus.PENDING,
            scheduledStartAt,
            joinWindowOpensAt,
            joinDeadlineAt,
            workDir: prepared.workDir,
            organizationId,
            interviewerId,
            quotaState: InterviewQuotaState.RESERVED,
            quotaReservedAt: now,
            candidateSnapshot: snapshots.candidateSnapshot as Prisma.InputJsonValue,
            problemSnapshot: snapshots.problemSnapshot as Prisma.InputJsonValue,
            evaluationCriteriaSnapshot: snapshots.evaluationCriteriaSnapshot as Prisma.InputJsonValue,
            aiEvaluationStatus: 'pending'
          },
          include: {
            candidate: true,
            problem: true
          }
        });

        createdInterviews.push(interview);
      }

      await reserveQuotaForCreatedInterviews(
        tx,
        organizationId,
        createdInterviews.map((interview) => interview.id),
        createdById
      );

      return {
        success: createdInterviews.length,
        failed: 0,
        results: createdInterviews.map((interview) => ({
          candidate: {
            name: interview.candidate.name,
            email: interview.candidate.email,
            phone: interview.candidate.phone || undefined
          },
          interview: {
            id: interview.id,
            token: interview.token,
            link: `${getWebPublicUrlBase()}/interview/${interview.token}`
          }
        })),
        errors: [],
        _interviews: createdInterviews
      };
    });

    // Fire-and-forget: sequentially prewarm OpenCode for each interview (avoid port pressure)
    (async () => {
      for (const prepared of preparedInterviews) {
        const interview = result._interviews.find(i => i.token === prepared.token);
        if (interview) {
          await startOpenCodeForInterview(interview.id, prepared.workDir, organizationId).catch(err => {
            console.error(`Failed to prewarm OpenCode for batch interview ${interview.id}:`, err);
          });
        }
      }
    })();

    return {
      success: result.success,
      failed: result.failed,
      results: result.results,
      errors: result.errors
    };
  } catch (error) {
    for (const prepared of preparedInterviews) {
      cleanupWorkDir(prepared.workDir);
    }
    throw error;
  }
}

export async function startInterview(token: string): Promise<InterviewWithRelations> {
  const interview = await prisma.interview.findUnique({
    where: { token },
    include: { problem: true, candidate: true }
  });

  if (!interview || interview.status !== InterviewStatus.PENDING) {
    throw new Error('Invalid interview');
  }

  const now = new Date();

  if (interview.joinWindowOpensAt && now < interview.joinWindowOpensAt) {
    throw new Error('面试尚未到可开始时间，请稍后再试');
  }

  if (interview.joinDeadlineAt && now > interview.joinDeadlineAt) {
    await markInterviewAsNoShow(interview.id);
    throw new Error('面试已超过入场截止时间，已标记为候选人未到场');
  }

  if (!interview.workDir || !fs.existsSync(interview.workDir)) {
    throw new Error('Interview workspace not found');
  }

  const manager = await getOpenCodeManager();

  try {
    let launchState = await resolveExistingLaunchState(manager, interview);

    if (!launchState && interview.openCodeStatus === 'starting') {
      // Poll DB for up to 30s waiting for it to become ready
      const pollStart = Date.now();
      while (Date.now() - pollStart < 30000) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const fresh = await prisma.interview.findUnique({
          where: { id: interview.id },
          select: { openCodeStatus: true, port: true, processId: true, dataDir: true }
        });
        if (fresh?.openCodeStatus === 'ready' && fresh.port) {
          launchState = await resolveExistingLaunchState(manager, {
            id: interview.id,
            workDir: interview.workDir,
            port: fresh.port,
            processId: fresh.processId,
            dataDir: fresh.dataDir
          });
          if (launchState) {
            break;
          }
        }
        if (fresh?.openCodeStatus === 'failed') {
          break;
        }
      }
    }

    if (!launchState) {
      if (typeof interview.port === 'number') {
        const isHealthy = await manager.checkHealth(interview.port);
        if (!isHealthy) {
          manager.releasePort(interview.port);
        }
      }

      // Fallback: synchronous launch (same as original logic)
      const apiKeyConfig = await prisma.organizationApiKeyConfig.findFirst({
        where: { organizationId: interview.organizationId, isSelected: true },
        select: { baseUrl: true, apiKey: true, modelId: true }
      });

      const result = await manager.startInstance(
        interview.id,
        interview.workDir,
        apiKeyConfig && apiKeyConfig.modelId
          ? { baseUrl: apiKeyConfig.baseUrl, apiKey: apiKeyConfig.apiKey, modelId: apiKeyConfig.modelId }
          : undefined
      );
      launchState = {
        port: result.port,
        processId: result.processId,
        dataDir: result.dataDir
      };
    }

    if (!launchState) {
      throw new Error('Failed to prepare interview workspace');
    }

    const launchSession = await manager.ensureLaunchSession(interview.id, launchState.port, interview.workDir);
    const port = launchState.port;
    const host = launchSession.host;
    const workspaceUrl = launchSession.sessionUrl;
    const processId = launchState.processId;
    const dataDir = launchState.dataDir;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + interview.duration * 60000);

    await prisma.interviewEvent.create({
      data: {
        interviewId: interview.id,
        eventType: InterviewEventType.STARTED,
        metadata: { port: port!, host: host!, workspaceUrl: workspaceUrl!, processId: processId! }
      }
    });

    return prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: InterviewStatus.IN_PROGRESS,
        startTime,
        endTime,
        port: port!,
        processId: processId!,
        dataDir: dataDir!,
        healthStatus: 'healthy',
        lastHealthCheck: startTime,
        openCodeStatus: 'ready'
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
  return prisma.interview.findUnique({
    where: { token },
    include: {
      candidate: true,
      problem: true
    }
  });
}

export async function submitInterview(token: string): Promise<InterviewWithRelations> {
  const interview = await prisma.interview.findUnique({
    where: { token },
    include: { problem: true, candidate: true }
  });

  if (!interview || interview.status !== InterviewStatus.IN_PROGRESS) {
    throw new Error('Interview is not in progress');
  }

  const manager = await getOpenCodeManager();

  if (interview.processId) {
    try {
      await manager.stopInstance(interview.id);
    } catch (error) {
      console.error('Failed to stop OpenCode instance:', error);
    }
  }

  const submittedAt = new Date();

  return finalizeInterview({
    interviewId: interview.id,
    organizationId: interview.organizationId,
    eventType: InterviewEventType.SUBMITTED,
    eventMetadata: { submittedAt: submittedAt.toISOString() },
    interviewUpdate: {
      status: InterviewStatus.COMPLETED,
      submittedAt,
      endReason: EndReason.CANDIDATE_SUBMIT,
      port: null,
      processId: null,
      aiEvaluationStatus: 'pending',
      manualReviewStatus: null
    },
    quotaAction: 'consume',
    quotaReason: InterviewQuotaLedgerReason.INTERVIEW_COMPLETED,
    triggerEvaluation: true
  });
}

export async function endInterviewByInterviewer(token: string): Promise<InterviewWithRelations> {
  const interview = await prisma.interview.findUnique({
    where: { token },
    include: { problem: true, candidate: true }
  });

  if (!interview || interview.status !== InterviewStatus.IN_PROGRESS) {
    throw new Error('Interview is not in progress');
  }

  const manager = await getOpenCodeManager();

  if (interview.processId) {
    try {
      await manager.stopInstance(interview.id);
    } catch (error) {
      console.error('Failed to stop OpenCode instance:', error);
    }
  }

  const endedAt = new Date();

  return finalizeInterview({
    interviewId: interview.id,
    organizationId: interview.organizationId,
    eventType: InterviewEventType.INTERVIEWER_ENDED,
    eventMetadata: { endedAt: endedAt.toISOString() },
    interviewUpdate: {
      status: InterviewStatus.COMPLETED,
      endReason: EndReason.INTERVIEWER_STOP,
      port: null,
      processId: null,
      aiEvaluationStatus: 'pending',
      manualReviewStatus: null
    },
    quotaAction: 'consume',
    quotaReason: InterviewQuotaLedgerReason.INTERVIEW_COMPLETED,
    createdById: interview.interviewerId,
    triggerEvaluation: true
  });
}

export async function cancelPendingInterview(
  interviewId: string,
  organizationId: string,
  createdById: string
) {
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      organizationId
    },
    include: {
      candidate: true,
      problem: true
    }
  });

  if (!interview) {
    throw new Error('Interview not found');
  }

  if (interview.status !== InterviewStatus.PENDING) {
    throw new Error('Only pending interviews can be cancelled');
  }

  // Stop prewarmed OpenCode instance if running
  if (interview.port || interview.openCodeStatus === 'ready') {
    try {
      const manager = await getOpenCodeManager();
      await manager.stopInstance(interview.id);
    } catch (error) {
      console.error('Failed to stop prewarmed OpenCode instance on cancel:', error);
    }
  }

  const cancelledAt = new Date();

  return finalizeInterview({
    interviewId: interview.id,
    organizationId,
    eventType: InterviewEventType.CANCELLED,
    eventMetadata: { cancelledAt: cancelledAt.toISOString() },
    interviewUpdate: {
      status: InterviewStatus.CANCELLED,
      cancelledAt,
      endReason: EndReason.CANCELLED_BY_ORG,
      aiEvaluationStatus: null,
      port: null,
      processId: null,
      openCodeStatus: null,
      openCodeError: null
    },
    quotaAction: 'release',
    quotaReason: InterviewQuotaLedgerReason.INTERVIEW_CANCELLED,
    createdById
  });
}

export async function markInterviewAsNoShow(interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      candidate: true,
      problem: true
    }
  });

  if (!interview || interview.status !== InterviewStatus.PENDING) {
    return interview;
  }

  // Stop prewarmed OpenCode instance if running
  if (interview.port || interview.openCodeStatus === 'ready') {
    try {
      const manager = await getOpenCodeManager();
      await manager.stopInstance(interview.id);
    } catch (error) {
      console.error('Failed to stop prewarmed OpenCode instance on no-show:', error);
    }
  }

  const cancelledAt = new Date();

  return finalizeInterview({
    interviewId: interview.id,
    organizationId: interview.organizationId,
    eventType: InterviewEventType.NO_SHOW,
    eventMetadata: {
      cancelledAt: cancelledAt.toISOString(),
      scheduledStartAt: interview.scheduledStartAt?.toISOString(),
      joinDeadlineAt: interview.joinDeadlineAt?.toISOString()
    },
    interviewUpdate: {
      status: InterviewStatus.CANCELLED,
      cancelledAt,
      endReason: EndReason.CANDIDATE_NO_SHOW,
      aiEvaluationStatus: null,
      port: null,
      processId: null,
      openCodeStatus: null,
      openCodeError: null
    },
    quotaAction: 'release',
    quotaReason: InterviewQuotaLedgerReason.CANDIDATE_NO_SHOW
  });
}

export async function completeInterviewOnTimeout(interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      candidate: true,
      problem: true
    }
  });

  if (!interview || interview.status !== InterviewStatus.IN_PROGRESS) {
    return interview;
  }

  const manager = await getOpenCodeManager();
  try {
    await manager.stopInstance(interview.id);
  } catch (error) {
    console.error('Failed to stop OpenCode instance on timeout:', error);
  }

  return finalizeInterview({
    interviewId: interview.id,
    organizationId: interview.organizationId,
    eventType: InterviewEventType.TIMEOUT,
    eventMetadata: { endTime: interview.endTime?.toISOString() },
    interviewUpdate: {
      status: InterviewStatus.COMPLETED,
      endReason: EndReason.TIME_UP,
      port: null,
      processId: null,
      healthStatus: null,
      aiEvaluationStatus: 'pending',
      manualReviewStatus: null
    },
    quotaAction: 'consume',
    quotaReason: InterviewQuotaLedgerReason.INTERVIEW_COMPLETED,
    triggerEvaluation: true
  });
}

export async function voidInterviewForSystemError(interviewId: string, processError: string) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      candidate: true,
      problem: true
    }
  });

  if (!interview || interview.status !== InterviewStatus.IN_PROGRESS) {
    return interview;
  }

  return finalizeInterview({
    interviewId: interview.id,
    organizationId: interview.organizationId,
    eventType: InterviewEventType.SYSTEM_ERROR,
    eventMetadata: { error: processError },
    interviewUpdate: {
      status: InterviewStatus.CANCELLED,
      cancelledAt: new Date(),
      endReason: EndReason.SYSTEM_ERROR,
      port: null,
      processId: null,
      healthStatus: 'unhealthy',
      processError,
      aiEvaluationStatus: null,
      manualReviewStatus: null
    },
    quotaAction: 'release',
    quotaReason: InterviewQuotaLedgerReason.SYSTEM_VOID
  });
}

export async function getInterviewEvents(token: string, page: number = 1, limit: number = 50) {
  const interview = await prisma.interview.findUnique({
    where: { token },
    select: { id: true }
  });

  if (!interview) {
    throw new Error('Interview not found');
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    prisma.interviewEvent.findMany({
      where: { interviewId: interview.id },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit
    }),
    prisma.interviewEvent.count({
      where: { interviewId: interview.id }
    })
  ]);

  return {
    data: events,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
