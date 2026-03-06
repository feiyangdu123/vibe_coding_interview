const { spawn } = require('child_process');

/**
 * 测试脚本：验证 OpenCode 评估逻辑是否能正确处理简单消息
 */
async function testOpenCodeEvaluation() {
  const prompt = "你好";
  const workDir = process.cwd(); // 使用当前目录作为工作目录
  const dataDir = process.env.HOME + '/.local/share/opencode-test'; // 测试用数据目录
  const timeout = 15000; // 15秒超时

  console.log('=== 开始测试 OpenCode 评估 ===');
  console.log(`Prompt: ${prompt}`);
  console.log(`Work Dir: ${workDir}`);
  console.log(`Data Dir: ${dataDir}`);
  console.log('');

  return new Promise((resolve, reject) => {
    const opencodePath = process.env.OPENCODE_PATH || 'opencode';

    // 设置环境变量
    const env = {
      ...process.env
      // 暂时不设置 XDG_DATA_HOME，看看是否会正常工作
      // XDG_DATA_HOME: dataDir
    };

    console.log(`[OpenCode] Spawning: ${opencodePath} run --format json "${prompt}"`);
    console.log(`[OpenCode] Args:`, ['run', '--format', 'json', prompt]);

    const child = spawn(opencodePath, ['run', '--format', 'json', prompt], {
      cwd: workDir,
      env,
      shell: false
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    console.log(`[OpenCode] Process spawned, PID: ${child.pid}`);

    // 立即关闭 stdin，告诉 opencode 不会有更多输入
    child.stdin.end();

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[stdout] ${chunk.substring(0, 200)}`);
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[stderr] ${chunk.substring(0, 200)}`);
    });

    child.on('close', (code, signal) => {
      if (isResolved) return;
      isResolved = true;

      console.log('');
      console.log('=== OpenCode 进程结束 ===');
      console.log(`Exit code: ${code}`);
      console.log(`Signal: ${signal}`);
      console.log(`stdout length: ${stdout.length}`);
      console.log(`stderr length: ${stderr.length}`);
      console.log('');

      if (code === 0) {
        console.log('✅ 成功获取输出');
        console.log('--- 完整输出 ---');
        console.log(stdout);
        console.log('--- 输出结束 ---');
        resolve(stdout);
      } else {
        console.log('❌ 执行失败');
        console.log('--- stderr ---');
        console.log(stderr);
        console.log('--- stdout ---');
        console.log(stdout);
        reject(new Error(`OpenCode failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      if (isResolved) return;
      isResolved = true;

      console.error('❌ 进程错误:', error);
      reject(new Error(`Failed to spawn OpenCode: ${error.message}`));
    });

    // 超时处理
    const timeoutHandle = setTimeout(() => {
      if (isResolved) return;
      isResolved = true;

      console.error(`⏱️  超时 (${timeout}ms)，终止进程`);
      child.kill('SIGTERM');

      setTimeout(() => {
        if (!child.killed) {
          console.error('强制终止进程');
          child.kill('SIGKILL');
        }
      }, 5000);

      reject(new Error(`Timeout after ${timeout}ms`));
    }, timeout);

    child.on('exit', () => {
      clearTimeout(timeoutHandle);
    });
  });
}

// 运行测试
testOpenCodeEvaluation()
  .then((output) => {
    console.log('');
    console.log('=== 测试成功 ===');
    console.log('返回内容:', output.substring(0, 200));
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('=== 测试失败 ===');
    console.error(error.message);
    process.exit(1);
  });
