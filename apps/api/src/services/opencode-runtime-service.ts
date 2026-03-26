import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const RUNTIME_ROOT = path.join(os.homedir(), '.local', 'share', 'vibe-opencode-runtime');

export function ensureDirectoryExists(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function removeInterviewRuntime(interviewId: string): void {
  const runtimeDir = path.join(RUNTIME_ROOT, interviewId);
  fs.rmSync(runtimeDir, {
    recursive: true,
    force: true
  });
}
