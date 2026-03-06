import { prisma } from '@vibe/database';
import { getChatHistory } from './chat-history-service';
import { spawn } from 'child_process';

const EVALUATION_TIMEOUT = parseInt(process.env.EVALUATION_TIMEOUT || '600000', 10); // 10 minutes
const MAX_RETRIES = parseInt(process.env.MAX_EVALUATION_RETRIES || '2', 10);

const EVALUATION_PROMPT_TEMPLATE = `你是一个评估候选人 vibe coding 能力的专家。请根据候选人与 AI 编程助手的交互历史，对其能力进行评分。

**项目路径**: {PROJECT_PATH}

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
 * 主评估函数：评估面试的 AI 交互历史
 */
export async function evaluateInterview(interviewId: string, retryCount: number = 0): Promise<void> {
  try {
    // 更新状态为 running
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        aiEvaluationStatus: 'running',
        aiEvaluationRetries: retryCount
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

    // 获取聊天历史
    const chatHistoryResponse = await getChatHistory(interviewId);

    if (chatHistoryResponse.error) {
      throw new Error(chatHistoryResponse.error);
    }

    const chatHistory = chatHistoryResponse.messages;

    if (!chatHistory || chatHistory.length === 0) {
      throw new Error('No chat history found for evaluation');
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

    // 构建 prompt
    const prompt = EVALUATION_PROMPT_TEMPLATE
      .replace('{PROJECT_PATH}', interview.workDir)
      .replace('{CHAT_HISTORY}', formattedHistory);

    // 执行评估
    console.log(`[Evaluation ${interviewId}] Starting OpenCode evaluation...`);
    const rawOutput = await runOpenCodeEvaluation(
      prompt,
      interview.workDir,
      interview.dataDir,
      EVALUATION_TIMEOUT
    );

    console.log(`[Evaluation ${interviewId}] Raw output received:`, rawOutput.substring(0, 200));

    // 解析结果
    const result = parseEvaluationResult(rawOutput);

    // 存储结果
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        aiEvaluationStatus: 'completed',
        aiEvaluationScore: result.score,
        aiEvaluationDetails: JSON.stringify(result.details), // 存储结构化的评估详情
        aiEvaluationRaw: rawOutput,
        aiEvaluatedAt: new Date(),
        aiEvaluationError: null
      }
    });

    console.log(`[Evaluation ${interviewId}] Completed: ${result.score}/10`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Evaluation ${interviewId}] Failed:`, errorMessage);

    // 判断是否需要重试
    if (retryCount < MAX_RETRIES) {
      console.log(`[Evaluation ${interviewId}] Retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      // 延迟 5 秒后重试
      setTimeout(() => {
        evaluateInterview(interviewId, retryCount + 1).catch(err => {
          console.error(`[Evaluation ${interviewId}] Retry failed:`, err);
        });
      }, 5000);
    } else {
      // 重试次数用尽，标记为失败
      console.error(`[Evaluation ${interviewId}] Max retries reached, marking as failed`);
      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          aiEvaluationStatus: 'failed',
          aiEvaluationError: errorMessage,
          aiEvaluationRetries: retryCount
        }
      });
    }
  }
}

/**
 * 使用 OpenCode 执行评估
 */
async function runOpenCodeEvaluation(
  prompt: string,
  workDir: string,
  dataDir: string,
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

    const child = spawn(opencodePath, ['run', prompt], {
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
    const summaryMatch = rawOutput.match(/整体评价[：:]\\s*(.+?)$/s);
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

