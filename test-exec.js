const { execSync } = require('child_process');

console.log('测试: 使用 execSync 同步执行 opencode');
console.log('');

try {
  const output = execSync('opencode run --format json "你好"', {
    encoding: 'utf-8',
    timeout: 10000,
    maxBuffer: 10 * 1024 * 1024 // 10MB
  });

  console.log('✅ 成功获取输出');
  console.log('输出长度:', output.length);
  console.log('');
  console.log('--- 输出内容 ---');
  console.log(output);
} catch (error) {
  console.error('❌ 执行失败');
  console.error('错误:', error.message);
  if (error.stdout) {
    console.log('stdout:', error.stdout.toString());
  }
  if (error.stderr) {
    console.log('stderr:', error.stderr.toString());
  }
}
