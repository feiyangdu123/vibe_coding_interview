import { prisma, InterviewEventType } from '@vibe/database';
import { getChatHistoryFromDataDir } from './chat-history-service';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

const EVALUATION_TIMEOUT = parseInt(process.env.EVALUATION_TIMEOUT || '600000', 10); // 10 minutes
const MAX_RETRIES = parseInt(process.env.MAX_EVALUATION_RETRIES || '2', 10);
const CLAUDE_CODE_PATH = process.env.CLAUDE_CODE_PATH || 'claude';

// runId -> EventEmitter, used for SSE streaming
const activeEvaluationStreams = new Map<string, EventEmitter>();

export function getEvaluationStream(runId: string): EventEmitter | null {
  return activeEvaluationStreams.get(runId) || null;
}

const EVALUATION_PROMPT_TEMPLATE = `你是一位资深的技术面试评估专家。请根据候选人与 AI 编程助手的完整交互历史，撰写一份深度叙述性评估报告（Markdown 格式）。

**题目信息**:
- 标题: {PROBLEM_TITLE}
- 要求: {PROBLEM_REQUIREMENTS}
- 评分细则: {SCORING_RUBRIC}

**面试信息**:
- 时长: {DURATION} 分钟
- 结束原因: {END_REASON}
- 项目路径: {PROJECT_PATH}

**聊天历史**:
{CHAT_HISTORY}

---

请撰写一份完整的 Markdown 评估报告，要求：

1. **面试概要**: 用 2-3 句话概述候选人的面试表现和最终完成情况。

2. **过程分析**: 按时间线描述候选人的关键决策和行为，引用聊天记录中的具体例子（如"候选人在第 N 轮对话中提到..."）。

3. **能力评估**: 从以下 5 个维度进行深度分析，每个维度用一个小节展开，包含具体行为举例和引用：
   - **需求拆分能力** — 候选人是否将复杂任务拆分成小的、可管理的部分？
   - **技术方案选择** — 候选人是否选择合适的技术方案并给出合理理由？
   - **研究优先方法论** — 候选人是否在实现前先研究和理解问题？
   - **沟通清晰度** — 候选人与 AI 的指令是否清晰、具体、有上下文？
   - **迭代改进** — 候选人是否审查 AI 输出并主动反馈改进？

4. **亮点与不足**: 分别列出候选人的突出亮点和明显不足，附具体例证。

5. **总结与建议**: 给出整体评价和改进建议。

注意：如果评分细则中指定了各维度的分值分配，请以评分细则为准。上述每维度默认各 20 分（总分 100 分）。

**报告末尾必须单独一行输出总分，格式为：**
**总分: X/100**`;

interface EvaluationDimension {
  name: string;
  score: number;
  reasoning: string;
}

interface EvaluationDetails {
  totalScore: number;
  report?: string;
  // Keep for backward compatibility with old evaluation data
  dimensions?: EvaluationDimension[];
  summary?: string;
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

    // 直接从原始 dataDir 读取聊天历史（Claude Code -p 是无状态的，无需快照）
    const chatHistoryResponse = await getChatHistoryFromDataDir(interview.dataDir);

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
          report: '## 评估结果\n\n候选人在面试期间未与 AI 编程助手进行任何交互，无法对其 vibe coding 能力进行评估。\n\n**总分: 0/100**'
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

      console.log(`[Evaluation ${interviewId}] Completed (version ${nextVersion}): 0/100 (no interaction)`);
      return;
    }

    // 格式化聊天历史 - 提取文本内容
    const formattedHistory = (chatHistoryResponse.messages as any[])
      .map((msg: any, idx: any) => {
        const textParts = msg.parts
          .filter((part: any) => part.type === 'text' || part.type === 'reasoning')
          .map((part: any) => part.content)
          .join('\n');
        return `[${idx + 1}] ${msg.role === 'user' ? '候选人' : 'AI'}: ${textParts}`;
      })
      .filter((line: any) => line.trim().length > 0)
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
      .replace('{SCORING_RUBRIC}', evaluationCriteriaSnapshot.scoringRubric || '无')
      .replace('{DURATION}', String(interview.duration))
      .replace('{END_REASON}', interview.endReason ? (endReasonMap[interview.endReason] || interview.endReason) : '未知')
      .replace('{PROJECT_PATH}', interview.workDir)
      .replace('{CHAT_HISTORY}', formattedHistory);

    // 执行评估（使用 Claude Code CLI）
    console.log(`[Evaluation ${interviewId}] Starting Claude Code evaluation (version ${nextVersion})...`);
    const rawOutput = await runClaudeCodeEvaluation(
      prompt,
      interview.workDir,
      run.id,
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
    const updateData: any = {
      aiEvaluationStatus: 'completed',
      aiEvaluationScore: result.score,
      aiEvaluationDetails: JSON.stringify(result.details),
      aiEvaluationRaw: rawOutput,
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

    // 记录 AI 评估完成事件
    await prisma.interviewEvent.create({
      data: {
        interviewId,
        eventType: InterviewEventType.AI_EVALUATION_FINISHED,
        metadata: { version: nextVersion, score: result.score, runId: run.id }
      }
    });

    console.log(`[Evaluation ${interviewId}] Completed (version ${nextVersion}): ${result.score}/100`);
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
 * 使用 Claude Code CLI 执行评估（流式输出）
 */
async function runClaudeCodeEvaluation(
  prompt: string,
  workDir: string,
  runId: string,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const emitter = new EventEmitter();
    activeEvaluationStreams.set(runId, emitter);

    console.log(`[Claude Code] Spawning: ${CLAUDE_CODE_PATH} -p`);
    console.log(`[Claude Code] Working directory: ${workDir}`);

    const child = spawn(CLAUDE_CODE_PATH, [
      '-p',
      '--verbose',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      prompt
    ], {
      cwd: workDir,
      env: process.env,
      shell: false
    });

    child.stdin.end();

    let accumulatedText = '';
    let stderr = '';
    let isResolved = false;
    let lineBuffer = '';

    child.stdout.on('data', (data) => {
      lineBuffer += data.toString();
      const lines = lineBuffer.split('\n');
      // Keep the last incomplete line in the buffer
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          // Extract text content from stream-json events
          const text = extractTextFromStreamEvent(event);
          if (text) {
            accumulatedText += text;
            emitter.emit('data', text);
          }
        } catch {
          // Non-JSON line, ignore
        }
      }
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[Claude Code stderr]`, chunk);
    });

    child.on('close', (code, signal) => {
      // Process any remaining buffer
      if (lineBuffer.trim()) {
        try {
          const event = JSON.parse(lineBuffer);
          const text = extractTextFromStreamEvent(event);
          if (text) {
            accumulatedText += text;
            emitter.emit('data', text);
          }
        } catch {
          // ignore
        }
      }

      if (isResolved) return;
      isResolved = true;

      console.log(`[Claude Code] Process closed with code=${code}, signal=${signal}`);

      emitter.emit('done');
      activeEvaluationStreams.delete(runId);

      if (code === 0) {
        // If stream-json produced no text, fall back to raw stdout
        resolve(accumulatedText || '');
      } else {
        const errorMsg = `Claude Code evaluation failed with code ${code}, signal ${signal}\nstderr: ${stderr}`;
        reject(new Error(errorMsg));
      }
    });

    child.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;

      console.error(`[Claude Code] Process error:`, error);
      emitter.emit('error', error.message);
      activeEvaluationStreams.delete(runId);
      reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
    });

    // 超时处理
    const timeoutHandle = setTimeout(() => {
      if (isResolved) return;
      isResolved = true;

      console.error(`[Claude Code] Timeout after ${timeout}ms, killing process`);
      child.kill('SIGTERM');

      setTimeout(() => {
        if (!child.killed) {
          console.error(`[Claude Code] Force killing process`);
          child.kill('SIGKILL');
        }
      }, 5000);

      emitter.emit('error', `Evaluation timeout after ${timeout}ms`);
      activeEvaluationStreams.delete(runId);
      reject(new Error(`Evaluation timeout after ${timeout}ms`));
    }, timeout);

    child.on('exit', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

/**
 * Extract text content from a Claude Code stream-json event
 */
function extractTextFromStreamEvent(event: any): string {
  // Claude Code stream-json format:
  // { "type": "assistant", "message": { "content": [{ "type": "text", "text": "..." }] } }
  // or partial message updates
  if (event.type === 'assistant' && event.message?.content) {
    return event.message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text || '')
      .join('');
  }

  // Content block delta
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text || '';
  }

  // Result message at end
  if (event.type === 'result' && event.result) {
    // The final result text — only use if we haven't accumulated any text yet
    return '';
  }

  return '';
}

/**
 * 解析评估结果
 */
function parseEvaluationResult(rawOutput: string): EvaluationResult {
  try {
    // 提取总分 - 匹配 "总分: X/100" 或 "总分: X"
    const scoreMatch = rawOutput.match(/总分[：:]\s*(\d+(?:\.\d+)?)\s*(?:\/\s*100)?/);

    if (!scoreMatch) {
      throw new Error('Could not find score in output');
    }

    const score = parseFloat(scoreMatch[1]);

    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score: ${score}`);
    }

    // 整个输出作为 Markdown 报告
    const report = rawOutput.trim();

    console.log(`[Evaluation] Parsed score: ${score}, report length: ${report.length}`);

    return {
      score,
      result: report,
      details: {
        totalScore: score,
        report
      }
    };
  } catch (error) {
    throw new Error(`Failed to parse evaluation result: ${error instanceof Error ? error.message : 'Unknown error'}\nRaw output: ${rawOutput.substring(0, 500)}`);
  }
}
