import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const RUNTIME_ROOT = path.join(os.homedir(), '.local', 'share', 'vibe-opencode-runtime');

interface RuntimeSnapshotPaths {
  rootDir: string;
  dataDir: string;
  workDir: string;
  dbPath: string;
}

function ensureDirectoryExists(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFreshDirectory(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory not found: ${src}`);
  }

  fs.rmSync(dest, { recursive: true, force: true });
  ensureDirectoryExists(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true });
}

async function rewriteSnapshotDatabasePaths(dbPath: string, workDir: string): Promise<void> {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READWRITE
  });

  const now = Date.now();

  try {
    await db.exec('BEGIN IMMEDIATE TRANSACTION');
    await db.run('UPDATE project SET worktree = ?, time_updated = ?', workDir, now);
    await db.run('UPDATE session SET directory = ?, time_updated = ? WHERE directory IS NOT NULL', workDir, now);
    await db.run('UPDATE workspace SET directory = ? WHERE directory IS NOT NULL', workDir);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  } finally {
    await db.close();
  }
}

function buildSnapshot(sourceDataDir: string, sourceWorkDir: string, target: RuntimeSnapshotPaths): void {
  copyFreshDirectory(sourceDataDir, target.dataDir);
  copyFreshDirectory(sourceWorkDir, target.workDir);
}

function getInterviewRuntimeRoot(interviewId: string): string {
  return path.join(RUNTIME_ROOT, interviewId);
}

export function getEvaluationSnapshotPaths(interviewId: string, runId: string): RuntimeSnapshotPaths {
  const rootDir = path.join(getInterviewRuntimeRoot(interviewId), 'eval', runId);
  const dataDir = path.join(rootDir, 'data');
  const workDir = path.join(rootDir, 'worktree');

  return {
    rootDir,
    dataDir,
    workDir,
    dbPath: path.join(dataDir, 'opencode', 'opencode.db')
  };
}

export async function createEvaluationSnapshot(
  interviewId: string,
  runId: string,
  sourceDataDir: string,
  sourceWorkDir: string
): Promise<RuntimeSnapshotPaths> {
  const snapshot = getEvaluationSnapshotPaths(interviewId, runId);
  buildSnapshot(sourceDataDir, sourceWorkDir, snapshot);
  await rewriteSnapshotDatabasePaths(snapshot.dbPath, snapshot.workDir);
  return snapshot;
}

export function removeEvaluationSnapshot(interviewId: string, runId: string): void {
  fs.rmSync(path.join(getInterviewRuntimeRoot(interviewId), 'eval', runId), {
    recursive: true,
    force: true
  });
}

export function removeInterviewRuntime(interviewId: string): void {
  fs.rmSync(getInterviewRuntimeRoot(interviewId), {
    recursive: true,
    force: true
  });
}

export function cleanupStaleEvaluationSnapshots(maxAgeMs: number): void {
  if (!fs.existsSync(RUNTIME_ROOT)) {
    return;
  }

  const now = Date.now();
  const interviewDirs = fs.readdirSync(RUNTIME_ROOT, { withFileTypes: true });

  for (const interviewDir of interviewDirs) {
    if (!interviewDir.isDirectory()) {
      continue;
    }

    const evalRoot = path.join(RUNTIME_ROOT, interviewDir.name, 'eval');
    if (!fs.existsSync(evalRoot)) {
      continue;
    }

    const runDirs = fs.readdirSync(evalRoot, { withFileTypes: true });
    for (const runDir of runDirs) {
      if (!runDir.isDirectory()) {
        continue;
      }

      const fullPath = path.join(evalRoot, runDir.name);
      const stats = fs.statSync(fullPath);
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }
}
