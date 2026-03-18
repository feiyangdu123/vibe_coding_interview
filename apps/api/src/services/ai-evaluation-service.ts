import { prisma, InterviewEventType } from '@vibe/database';
import { getChatHistoryFromDataDir } from './chat-history-service';
import { spawn } from 'child_process';
import { createEvaluationSnapshot, removeEvaluationSnapshot } from './opencode-runtime-service';

const EVALUATION_TIMEOUT = parseInt(process.env.EVALUATION_TIMEOUT || '600000', 10); // 10 minutes
const MAX_RETRIES = parseInt(process.env.MAX_EVALUATION_RETRIES || '2', 10);

const EVALUATION_PROMPT_TEMPLATE = `你是一个评估候选人 vibe coding 能力的专家。请根据候选人与 AI 编程助手的交互历史，对其能力进行评分。

**题目信息**:
标题: {PROBLEM_TITLE}
要求: {PROBLEM_REQUIREMENTS}
验收标准: {ACCEPTANCE_CRITERIA}
评估说明: {EVALUATION_INSTRUCTIONS}

**面试信息**:
时长: {DURATION} 分钟
结束原因: {END_REASON}
项目路径: {PROJECT_PATH}

**聊天历史**:
{CHAT_HISTORY}

**评分标准**（总分 10 分，5 个维度，每个维度 0-2 分）:

1. **需求拆分能力 (0-2 分)** - 候选人是否将复杂任务拆分成小的、可管理的部分？
2. **技术方案选择 (0-2 分)** - 候选人是否选择合适的技术方案？
3. **研究优先方法论 (0-2 分)** - 候选人是否在开始实现前先研究和理解问题？
4. **沟通清晰度 (0-2 分)** - 候选人的指令有多清晰和具体？
5. **迭代改进 (0-2 分)** - 候选人是否审查 AI 的输出并提供反馈？

请直接输出评估结果，格式如下：
总分: X/10

1. 需求拆分能力: X/2 - 原因
2. 技术方案选择: X/2 - 原因
3. 研究优先方法论: X/2 - 原因
4. 沟通清晰度: X/2 - 原因
5. 迭代改进: X/2 - 原因

整体评价: 2-3句话的总结`;

interface EvaluationDimension {
  name: string;
  score: number;
  reasoning: string;
}

interface EvaluationDetails {
  totalScore: number;
  dimensions: EvaluationDimension[];
  summary: string;
}

interface EvaluationResult {
  score: number;
  result: string;
  details: EvaluationDetails;
}

/**
 * 主评估函数：评估面试的 AI 交互历史（版本化）
 * 每次评估创建一个新的 AiEvaluationRun 记录
 */
export async function evaluateInterview(
  interviewId: string,
  triggeredBy?: string,
  retryCount: number = 0
): Promise<void> {
  // 获取下一个版本号
  const lastRun = await prisma.aiEvaluationRun.findFirst({
    where: { interviewId },
    orderBy: { version: 'desc' },
    select: { version: true }
  });
  const nextVersion = (lastRun?.version ?? 0) + 1;

  // 创建新的 AiEvaluationRun 记录
  const run = await prisma.aiEvaluationRun.create({
    data: {
      interviewId,
      version: nextVersion,
      status: 'running',
      triggeredBy: triggeredBy || null,
      retries: retryCount
    }
  });

  try {
    // 更新 Interview 状态为 running
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        aiEvaluationStatus: 'running',
        aiEvaluationRetries: retryCount
      }
    });

    await prisma.interviewEvent.create({
      data: {
        interviewId,
        eventType: InterviewEventType.AI_EVALUATION_STARTED,
        metadata: {
          version: nextVersion,
          triggeredBy: triggeredBy || null,
          retryCount
        }
      }
    });

    // 获取面试信息
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: { problem: true }
    });

    if (!interview) {
      throw new Error('Interview not found');
    }

    if (!interview.workDir || !interview.dataDir) {
      throw new Error('Interview workspace or data directory not found');
    }

    const evaluationSnapshot = await createEvaluationSnapshot(
      interviewId,
      run.id,
      interview.dataDir,
      interview.workDir
    );

    try {
      // 获取聊天历史
      const chatHistoryResponse = await getChatHistoryFromDataDir(evaluationSnapshot.dataDir);

      if (chatHistoryResponse.error) {
        throw new Error(chatHistoryResponse.error);
      }

      // 候选人没有与 AI 交互（没有 session 或没有消息），直接给零分
      const hasNoInteraction = !chatHistoryResponse.sessionId
        || !chatHistoryResponse.messages
        || chatHistoryResponse.messages.length === 0;

      if (hasNoInteraction) {
        console.log(`[Evaluation ${interviewId}] No chat history found — candidate did not interact. Assigning zero score.`);

        const zeroResult: EvaluationResult = {
          score: 0,
          result: '候选人未与 AI 助手进行任何交互，无法评估。',
          details: {
            totalScore: 0,
            dimensions: [
              { name: '需求拆分能力', score: 0, reasoning: '候选人未进行任何交互' },
              { name: '技术方案选择', score: 0, reasoning: '候选人未进行任何交互' },
              { name: '研究优先方法论', score: 0, reasoning: '候选人未进行任何交互' },
              { name: '沟通清晰度', score: 0, reasoning: '候选人未进行任何交互' },
              { name: '迭代改进', score: 0, reasoning: '候选人未进行任何交互' },
            ],
            summary: '候选人在面试期间未与 AI 编程助手进行任何交互，无法对其 vibe coding 能力进行评估。'
          }
        };

        // 更新 AiEvaluationRun 记录
        await prisma.aiEvaluationRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            score: 0,
            details: zeroResult.details as any,
            rawOutput: zeroResult.result,
            completedAt: new Date(),
            retries: retryCount
          }
        });

        const updateData: any = {
          aiEvaluationStatus: 'completed',
          aiEvaluationScore: 0,
          aiEvaluationDetails: JSON.stringify(zeroResult.details),
          aiEvaluationRaw: zeroResult.result,
          aiEvaluatedAt: new Date(),
          aiEvaluationError: null,
          currentAiRunId: run.id
        };

        if (interview.manualReviewStatus !== 'completed') {
          updateData.manualReviewStatus = 'pending';
        }

        await prisma.interview.update({
          where: { id: interviewId },
          data: updateData
        });

        await prisma.interviewEvent.create({
          data: {
            interviewId,
            eventType: InterviewEventType.AI_EVALUATION_FINISHED,
            metadata: { version: nextVersion, score: 0, runId: run.id, noInteraction: true }
          }
        });

        console.log(`[Evaluation ${interviewId}] Completed (version ${nextVersion}): 0/10 (no interaction)`);
        return;
      }

      // 格式化聊天历史 - 提取文本内容
      const formattedHistory = chatHistory
        .map((msg, idx) => {
          const textParts = msg.parts
            .filter(part => part.type === 'text' || part.type === 'reasoning')
            .map(part => part.content)
            .join('\n');
          return `[${idx + 1}] ${msg.role === 'user' ? '候选人' : 'AI'}: ${textParts}`;
        })
        .filter(line => line.trim().length > 0)
        .join('\n\n');

      // 提取题目快照信息
      const problemSnapshot = interview.problemSnapshot as any || {};
      const evaluationCriteriaSnapshot = interview.evaluationCriteriaSnapshot as any || {};
      const endReasonMap: Record<string, string> = {
        TIME_UP: '时间到',
        CANDIDATE_SUBMIT: '候选人提交',
        INTERVIEWER_STOP: '面试官终止',
        SYSTEM_ERROR: '系统错误'
      };

      // 构建增强 prompt
      const prompt = EVALUATION_PROMPT_TEMPLATE
        .replace('{PROBLEM_TITLE}', problemSnapshot.title || interview.problem.title || '未知')
        .replace('{PROBLEM_REQUIREMENTS}', problemSnapshot.requirements || interview.problem.requirements || '无')
        .replace('{ACCEPTANCE_CRITERIA}', JSON.stringify(evaluationCriteriaSnapshot.acceptanceCriteria || '无', null, 2))
        .replace('{EVALUATION_INSTRUCTIONS}', evaluationCriteriaSnapshot.evaluationInstructionsText || '无')
        .replace('{DURATION}', String(interview.duration))
        .replace('{END_REASON}', interview.endReason ? (endReasonMap[interview.endReason] || interview.endReason) : '未知')
        .replace('{PROJECT_PATH}', evaluationSnapshot.workDir)
        .replace('{CHAT_HISTORY}', formattedHistory);

      // 执行评估
      console.log(`[Evaluation ${interviewId}] Starting OpenCode evaluation (version ${nextVersion})...`);
      const rawOutput = await runOpenCodeEvaluation(
        prompt,
        evaluationSnapshot.workDir,
        evaluationSnapshot.dataDir,
        chatHistoryResponse.sessionId,
        EVALUATION_TIMEOUT
      );

      console.log(`[Evaluation ${interviewId}] Raw output received:`, rawOutput.substring(0, 200));

      // 解析结果
      const result = parseEvaluationResult(rawOutput);

      // 更新 AiEvaluationRun 记录
      await prisma.aiEvaluationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          score: result.score,
          details: result.details as any,
          rawOutput,
          completedAt: new Date(),
          retries: retryCount
        }
      });

      // 更新 Interview 快照字段和 currentAiRunId
      // 如果 manualReviewStatus 还不是 'completed'，设置为 'pending'
      const updateData: any = {
        aiEvaluationStatus: 'completed',
        aiEvaluationScore: result.score,
        aiEvaluationDetails: JSON.stringify(result.details),
        aiEvaluationRaw: rawOutput,
        aiEvaluatedAt: new Date(),
        aiEvaluationError: null,
        currentAiRunId: run.id
      };

      // 只有未复核的面试才设置 manualReviewStatus 为 pending
      if (interview.manualReviewStatus !== 'completed') {
        updateData.manualReviewStatus = 'pending';
      }

      await prisma.interview.update({
        where: { id: interviewId },
        data: updateData
      });

      // 记录 AI 评估完成事件
      await prisma.interviewEvent.create({
        data: {
          interviewId,
          eventType: InterviewEventType.AI_EVALUATION_FINISHED,
          metadata: { version: nextVersion, score: result.score, runId: run.id }
        }
      });

      console.log(`[Evaluation ${interviewId}] Completed (version ${nextVersion}): ${result.score}/10`);
    } finally {
      removeEvaluationSnapshot(interviewId, run.id);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Evaluation ${interviewId}] Failed (version ${nextVersion}):`, errorMessage);

    // 判断是否需要重试
    if (retryCount < MAX_RETRIES) {
      console.log(`[Evaluation ${interviewId}] Retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);

      // 更新 run 的重试次数
      await prisma.aiEvaluationRun.update({
        where: { id: run.id },
        data: { retries: retryCount + 1 }
      });

      // 延迟 5 秒后重试（仍然使用同一个 run 记录）
      setTimeout(async () => {
        try {
          // 删除当前 run（重试会创建新的）
          await prisma.aiEvaluationRun.delete({ where: { id: run.id } });
          await evaluateInterview(interviewId, triggeredBy, retryCount + 1);
        } catch (err) {
          console.error(`[Evaluation ${interviewId}] Retry failed:`, err);
        }
      }, 5000);
    } else {
      // 重试次数用尽，标记为失败
      console.error(`[Evaluation ${interviewId}] Max retries reached, marking as failed`);

      // 更新 AiEvaluationRun 为失败
      await prisma.aiEvaluationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
          retries: retryCount
        }
      });

      // 更新 Interview 快照字段
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          aiEvaluationStatus: 'failed',
          aiEvaluationError: errorMessage,
          aiEvaluationRetries: retryCount,
          currentAiRunId: run.id
        }
      });
    }
  }
}

/**
 * 获取面试的所有评估历史（按版本降序）
 */
export async function getEvaluationHistory(interviewId: string): Promise<any[]> {
  return prisma.aiEvaluationRun.findMany({
    where: { interviewId },
    orderBy: { version: 'desc' }
  });
}

/**
 * 获取指定评估版本的详细信息
 */
export async function getEvaluationRun(runId: string): Promise<any | null> {
  return prisma.aiEvaluationRun.findUnique({
    where: { id: runId }
  });
}

/**
 * 使用 OpenCode 执行评估
 */
async function runOpenCodeEvaluation(
  prompt: string,
  workDir: string,
  dataDir: string,
  sessionId: string,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const opencodePath = process.env.OPENCODE_PATH || 'opencode';

    // 设置环境变量，指向面试的数据目录（使用与面试时相同的 dataDir）
    const env = {
      ...process.env,
      XDG_DATA_HOME: dataDir
    };

    console.log(`[OpenCode] Spawning: ${opencodePath} run`);
    console.log(`[OpenCode] Working directory: ${workDir}`);
    console.log(`[OpenCode] Data directory: ${dataDir}`);

    const child = spawn(opencodePath, ['run', '--session', sessionId, '--fork', '--dir', workDir, prompt], {
      cwd: workDir,
      env,
      shell: false
    });

    // 立即关闭 stdin，告诉 opencode 不会有更多输入
    child.stdin.end();

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[OpenCode stdout]`, chunk);
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[OpenCode stderr]`, chunk);
    });

    child.on('close', (code, signal) => {
      if (isResolved) return;
      isResolved = true;

      console.log(`[OpenCode] Process closed with code=${code}, signal=${signal}`);
      console.log(`[OpenCode] stdout length: ${stdout.length}, stderr length: ${stderr.length}`);

      if (code === 0) {
        resolve(stdout);
      } else {
        const errorMsg = `OpenCode evaluation failed with code ${code}, signal ${signal}\nstderr: ${stderr}\nstdout: ${stdout}`;
        reject(new Error(errorMsg));
      }
    });

    child.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;

      console.error(`[OpenCode] Process error:`, error);
      reject(new Error(`Failed to spawn OpenCode: ${error.message}`));
    });

    // 超时处理
    const timeoutHandle = setTimeout(() => {
      if (isResolved) return;
      isResolved = true;

      console.error(`[OpenCode] Timeout after ${timeout}ms, killing process`);
      child.kill('SIGTERM');

      // Force kill after 5 seconds if still alive
      setTimeout(() => {
        if (!child.killed) {
          console.error(`[OpenCode] Force killing process`);
          child.kill('SIGKILL');
        }
      }, 5000);

      reject(new Error(`Evaluation timeout after ${timeout}ms`));
    }, timeout);

    // Clear timeout if process completes
    child.on('exit', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

/**
 * 解析评估结果
 */
function parseEvaluationResult(rawOutput: string): EvaluationResult {
  try {
    // 提取总分 - 匹配 "总分: X/10" 或 "总分: X"
    const scoreMatch = rawOutput.match(/总分[：:]\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/);

    if (!scoreMatch) {
      throw new Error('Could not find score in output');
    }

    const score = parseFloat(scoreMatch[1]);

    if (isNaN(score) || score < 0 || score > 10) {
      throw new Error(`Invalid score: ${score}`);
    }

    // 提取各维度评分
    const dimensions: EvaluationDimension[] = [];
    const dimensionNames = [
      '需求拆分能力',
      '技术方案选择',
      '研究优先方法论',
      '沟通清晰度',
      '迭代改进'
    ];

    for (const dimName of dimensionNames) {
      // 匹配格式: "1. 需求拆分能力: X/2 - 原因"
      // 使用更宽松的匹配，捕获到下一个数字开头的行或整体评价之前
      const dimRegex = new RegExp(`\\d+\\.\\s*${dimName}[：:]\\s*(\\d+(?:\\.\\d+)?)\\s*\\/\\s*2\\s*[-–—]\\s*(.+?)(?=\\n\\d+\\.|\\n整体评价|$)`, 's');
      const dimMatch = rawOutput.match(dimRegex);

      if (dimMatch) {
        dimensions.push({
          name: dimName,
          score: parseFloat(dimMatch[1]),
          reasoning: dimMatch[2].trim()
        });
      }
    }

    // 提取整体评价
    const summaryMatch = rawOutput.match(/整体评价[：:]\s*(.+?)$/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : '无整体评价';

    console.log(`[Evaluation] Parsed ${dimensions.length} dimensions, summary length: ${summary.length}`);

    // 返回分数和完整的评估文本
    return {
      score,
      result: rawOutput.trim(),
      details: {
        totalScore: score,
        dimensions,
        summary
      }
    };
  } catch (error) {
    throw new Error(`Failed to parse evaluation result: ${error instanceof Error ? error.message : 'Unknown error'}\nRaw output: ${rawOutput.substring(0, 500)}`);
  }
}
