import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as http from 'http';
import * as fs from 'fs';

const DEFAULT_OPENCODE_SLOTS = 'localhost:4100,localhost:4101,localhost:4102,localhost:4103,localhost:4104';

export interface InstanceInfo {
  interviewId: string;
  host: string;
  workspaceUrl: string;
  port: number;
  processId: number;
  process: ChildProcess;
  workDir: string;
  dataDir: string;
  startedAt: Date;
  apiKeyConfig?: ApiKeyConfig;
  restartCount: number;
}

interface OpenCodeSlot {
  host: string;
  port: number;
  workspaceUrl: string;
}

export interface LaunchConfig {
  interviewId: string;
  port: number;
  workDir: string;
}

export interface ApiKeyConfig {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

function getWorkspaceProtocol(host: string): 'http' | 'https' {
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http';
  }

  const publicUrl = process.env.WEB_PUBLIC_URL || process.env.WEB_URL;
  if (publicUrl) {
    try {
      return new URL(publicUrl).protocol === 'http:' ? 'http' : 'https';
    } catch {
      // Fall through to the default protocol below.
    }
  }

  return 'https';
}

function buildWorkspaceUrl(host: string): string {
  if (/^https?:\/\//.test(host)) {
    return host;
  }

  return `${getWorkspaceProtocol(host)}://${host}`;
}

function getCapacityExceededError(slotCount: number): string {
  return `当前演示环境已满，最多同时支持 ${slotCount} 场进行中的面试`;
}

function parseSlots(rawSlots: string | undefined): OpenCodeSlot[] {
  const source = rawSlots?.trim() || DEFAULT_OPENCODE_SLOTS;
  const seenPorts = new Set<number>();

  return source.split(',').map((entry) => {
    const trimmedEntry = entry.trim();
    const separatorIndex = trimmedEntry.lastIndexOf(':');

    if (separatorIndex <= 0 || separatorIndex === trimmedEntry.length - 1) {
      throw new Error(`Invalid OPENCODE_SLOTS entry "${trimmedEntry}". Expected format "host:port".`);
    }

    const host = trimmedEntry.slice(0, separatorIndex).trim();
    const port = Number(trimmedEntry.slice(separatorIndex + 1));

    if (!host) {
      throw new Error(`Invalid OPENCODE_SLOTS entry "${trimmedEntry}". Host is required.`);
    }

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`Invalid OPENCODE_SLOTS entry "${trimmedEntry}". Port must be a positive integer.`);
    }

    if (seenPorts.has(port)) {
      throw new Error(`Duplicate OpenCode slot port detected: ${port}`);
    }

    seenPorts.add(port);

    return {
      host,
      port,
      workspaceUrl: buildWorkspaceUrl(host)
    };
  });
}

class SlotManager {
  private readonly slots: OpenCodeSlot[];
  private readonly bindHost: string;
  private usedPorts: Set<number> = new Set();

  constructor(slots: OpenCodeSlot[], bindHost: string) {
    this.slots = slots;
    this.bindHost = bindHost;
  }

  async allocate(): Promise<OpenCodeSlot> {
    const availableSlots = this.slots.filter((slot) => !this.usedPorts.has(slot.port));

    if (availableSlots.length === 0) {
      throw new Error(getCapacityExceededError(this.slots.length));
    }

    for (const slot of availableSlots) {
      if (await this.isPortAvailable(slot.port)) {
        this.usedPorts.add(slot.port);
        return slot;
      }
    }

    throw new Error('No available OpenCode slot ports on the configured bind host');
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, this.bindHost);
    });
  }

  release(port: number): void {
    this.usedPorts.delete(port);
  }

  markUsed(port: number): void {
    if (!this.getSlotByPort(port)) {
      console.warn(`[OpenCodeManager] Ignoring active port ${port} because it is not defined in OPENCODE_SLOTS.`);
      return;
    }

    this.usedPorts.add(port);
  }

  getSlotByPort(port: number): OpenCodeSlot | undefined {
    return this.slots.find((slot) => slot.port === port);
  }
}

export type CrashCallback = (interviewId: string, port: number, restartCount: number) => void;

export class OpenCodeManager {
  private slotManager: SlotManager;
  private instances: Map<string, InstanceInfo>;
  private opencodePath: string;
  private bindHost: string;
  private healthCheckHost: string;
  private onCrashCallback: CrashCallback | null = null;
  private stoppingSessions: Set<string> = new Set();

  constructor(opencodePath: string = 'opencode') {
    this.bindHost = process.env.OPENCODE_BIND_HOST || '127.0.0.1';
    this.healthCheckHost = this.bindHost === '0.0.0.0' ? '127.0.0.1' : this.bindHost;
    this.slotManager = new SlotManager(parseSlots(process.env.OPENCODE_SLOTS), this.bindHost);
    this.instances = new Map();
    this.opencodePath = opencodePath;
  }

  onInstanceCrash(callback: CrashCallback): void {
    this.onCrashCallback = callback;
  }

  releasePort(port: number): void {
    this.slotManager.release(port);
  }

  /**
   * Initialize port manager with ports from active interviews in database
   */
  initializeWithActivePorts(activePorts: number[]): void {
    activePorts.forEach(port => {
      this.slotManager.markUsed(port);
    });
  }

  async startInstance(interviewId: string, workDir: string, apiKeyConfig?: ApiKeyConfig): Promise<{ host: string; workspaceUrl: string; port: number; processId: number; dataDir: string }> {
    if (this.instances.has(interviewId)) {
      const existing = this.instances.get(interviewId)!;
      return {
        host: existing.host,
        workspaceUrl: existing.workspaceUrl,
        port: existing.port,
        processId: existing.processId,
        dataDir: existing.dataDir
      };
    }

    const slot = await this.slotManager.allocate();
    const homeDir = os.homedir();
    const dataDir = path.join(homeDir, '.local', 'share', `opencode-${interviewId}`);

    // Create unique data directory for this interview
    fs.mkdirSync(dataDir, { recursive: true });

    // Write OpenCode config files if API key config is provided
    if (apiKeyConfig) {
      // Write auth.json to {dataDir}/opencode/auth.json
      const authDir = path.join(dataDir, 'opencode');
      fs.mkdirSync(authDir, { recursive: true });
      const authJson = {
        custom: {
          type: 'api',
          key: apiKeyConfig.apiKey
        }
      };
      fs.writeFileSync(path.join(authDir, 'auth.json'), JSON.stringify(authJson, null, 2));

      // Write opencode.json to {configDir}/opencode/opencode.json (not workDir, to avoid exposing config to candidates)
      const configDir = path.join(dataDir, 'config');
      const opencodeConfigDir = path.join(configDir, 'opencode');
      fs.mkdirSync(opencodeConfigDir, { recursive: true });
      const opencodeJson = {
        '$schema': 'https://opencode.ai/config.json',
        provider: {
          custom: {
            npm: '@ai-sdk/openai-compatible',
            name: 'Custom Provider',
            options: {
              baseURL: apiKeyConfig.baseUrl
            },
            models: {
              [apiKeyConfig.modelId]: {
                name: apiKeyConfig.modelId
              }
            }
          }
        }
      };
      fs.writeFileSync(path.join(opencodeConfigDir, 'opencode.json'), JSON.stringify(opencodeJson, null, 2));
    }

    const configDir = path.join(dataDir, 'config');
    const spawnArgs = ['serve', '--port', slot.port.toString(), '--hostname', this.bindHost];
    const spawnEnv = { ...process.env, XDG_DATA_HOME: dataDir, XDG_CONFIG_HOME: configDir };
    console.log(`[OpenCode] Starting instance for interview=${interviewId}`);
    console.log(`[OpenCode]   command: ${this.opencodePath} ${spawnArgs.join(' ')}`);
    console.log(`[OpenCode]   cwd (workDir): ${workDir}`);
    console.log(`[OpenCode]   XDG_DATA_HOME (dataDir): ${dataDir}`);
    console.log(`[OpenCode]   port: ${slot.port}`);

    const child = spawn(this.opencodePath, spawnArgs, {
      env: spawnEnv,
      cwd: workDir,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!child.pid) {
      this.slotManager.release(slot.port);
      throw new Error('Failed to start OpenCode instance');
    }

    console.log(`[OpenCode]   pid: ${child.pid}`);

    const instanceInfo: InstanceInfo = {
      interviewId,
      host: slot.host,
      workspaceUrl: slot.workspaceUrl,
      port: slot.port,
      processId: child.pid,
      process: child,
      workDir,
      dataDir,
      startedAt: new Date(),
      apiKeyConfig,
      restartCount: 0
    };

    this.instances.set(interviewId, instanceInfo);
    this._setupChildProcess(child, instanceInfo);

    // Wait for health check
    const isHealthy = await this.waitForHealthy(slot.port);
    if (!isHealthy) {
      // Cleanup on failure
      this.stoppingSessions.add(interviewId);
      try {
        child.kill();
      } catch (e) {
        // Ignore
      }
      this.instances.delete(interviewId);
      this.slotManager.release(slot.port);
      this.stoppingSessions.delete(interviewId);
      throw new Error(`OpenCode instance failed to start on port ${slot.port}`);
    }

    // Wait for OpenCode to finish internal initialization (project/workspace tables in SQLite)
    await this.waitForProjectReady(dataDir);

    return {
      host: slot.host,
      workspaceUrl: slot.workspaceUrl,
      port: slot.port,
      processId: child.pid,
      dataDir
    };
  }

  async restartInstance(
    interviewId: string,
    port: number,
    workDir: string,
    dataDir: string,
    apiKeyConfig?: ApiKeyConfig,
    restartCount: number = 0
  ): Promise<{ port: number; processId: number; dataDir: string }> {
    const slot = this.slotManager.getSlotByPort(port);
    if (!slot) {
      throw new Error(`No slot found for port ${port}`);
    }

    // Rewrite config files if needed
    if (apiKeyConfig) {
      const authDir = path.join(dataDir, 'opencode');
      fs.mkdirSync(authDir, { recursive: true });
      const authJson = {
        custom: {
          type: 'api',
          key: apiKeyConfig.apiKey
        }
      };
      fs.writeFileSync(path.join(authDir, 'auth.json'), JSON.stringify(authJson, null, 2));

      const configDir = path.join(dataDir, 'config');
      const opencodeConfigDir = path.join(configDir, 'opencode');
      fs.mkdirSync(opencodeConfigDir, { recursive: true });
      const opencodeJson = {
        '$schema': 'https://opencode.ai/config.json',
        provider: {
          custom: {
            npm: '@ai-sdk/openai-compatible',
            name: 'Custom Provider',
            options: {
              baseURL: apiKeyConfig.baseUrl
            },
            models: {
              [apiKeyConfig.modelId]: {
                name: apiKeyConfig.modelId
              }
            }
          }
        }
      };
      fs.writeFileSync(path.join(opencodeConfigDir, 'opencode.json'), JSON.stringify(opencodeJson, null, 2));
    }

    const configDir = path.join(dataDir, 'config');
    const spawnArgs = ['serve', '--port', port.toString(), '--hostname', this.bindHost];
    const spawnEnv = { ...process.env, XDG_DATA_HOME: dataDir, XDG_CONFIG_HOME: configDir };
    console.log(`[OpenCode] Restarting instance for interview=${interviewId} (restartCount=${restartCount})`);
    console.log(`[OpenCode]   command: ${this.opencodePath} ${spawnArgs.join(' ')}`);
    console.log(`[OpenCode]   cwd (workDir): ${workDir}`);
    console.log(`[OpenCode]   XDG_DATA_HOME (dataDir): ${dataDir}`);
    console.log(`[OpenCode]   port: ${port}`);

    const child = spawn(this.opencodePath, spawnArgs, {
      env: spawnEnv,
      cwd: workDir,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!child.pid) {
      this.slotManager.release(port);
      throw new Error('Failed to restart OpenCode instance');
    }

    console.log(`[OpenCode]   pid: ${child.pid}`);

    const instanceInfo: InstanceInfo = {
      interviewId,
      host: slot.host,
      workspaceUrl: slot.workspaceUrl,
      port,
      processId: child.pid,
      process: child,
      workDir,
      dataDir,
      startedAt: new Date(),
      apiKeyConfig,
      restartCount
    };

    this.instances.set(interviewId, instanceInfo);
    this._setupChildProcess(child, instanceInfo);

    const isHealthy = await this.waitForHealthy(port);
    if (!isHealthy) {
      this.stoppingSessions.add(interviewId);
      try {
        child.kill();
      } catch (e) {
        // Ignore
      }
      this.instances.delete(interviewId);
      this.slotManager.release(port);
      this.stoppingSessions.delete(interviewId);
      throw new Error(`OpenCode instance failed to restart on port ${port}`);
    }

    // Wait for OpenCode to finish internal initialization (project/workspace tables in SQLite)
    await this.waitForProjectReady(dataDir);

    return { port, processId: child.pid, dataDir };
  }

  private _setupChildProcess(child: ChildProcess, instanceInfo: InstanceInfo): void {
    const { interviewId, port } = instanceInfo;

    child.on('error', (error) => {
      console.error('Failed to spawn OpenCode:', error);
      console.error('Path:', this.opencodePath);
      console.error('WorkDir:', instanceInfo.workDir);
      if (!this.stoppingSessions.has(interviewId)) {
        this.instances.delete(interviewId);
        // Don't release port — keep it for restart
        if (this.onCrashCallback) {
          this.onCrashCallback(interviewId, port, instanceInfo.restartCount);
        }
      }
    });

    child.stderr?.on('data', (data) => {
      console.error('OpenCode stderr:', data.toString());
    });

    child.stdout?.on('data', (data) => {
      console.log('OpenCode stdout:', data.toString());
    });

    child.on('exit', (code) => {
      if (this.stoppingSessions.has(interviewId)) {
        // Intentional stop — normal cleanup
        this.instances.delete(interviewId);
        this.slotManager.release(port);
        this.stoppingSessions.delete(interviewId);
      } else {
        // Crash — delete instance but keep port reserved for restart
        const restartCount = instanceInfo.restartCount;
        this.instances.delete(interviewId);
        console.error(`OpenCode process for interview ${interviewId} exited unexpectedly with code ${code}`);
        if (this.onCrashCallback) {
          this.onCrashCallback(interviewId, port, restartCount);
        }
      }
    });
  }

  async stopInstance(interviewId: string): Promise<void> {
    const instance = this.instances.get(interviewId);
    if (!instance) {
      return;
    }

    this.stoppingSessions.add(interviewId);

    try {
      instance.process.kill();
    } catch (error) {
      console.error(`Failed to kill process ${instance.processId}:`, error);
    }

    // Note: instances.delete, slotManager.release, and stoppingSessions.delete
    // are handled by the exit handler in _setupChildProcess to avoid race conditions.
    // process.kill() is async (sends signal), so the exit handler fires later.
  }

  async cleanupExpired(): Promise<void> {
    // This will be called by the API service with database context
  }

  getInstance(interviewId: string): InstanceInfo | undefined {
    return this.instances.get(interviewId);
  }

  getAllInstances(): InstanceInfo[] {
    return Array.from(this.instances.values());
  }

  getHost(port: number): string | undefined {
    return this.slotManager.getSlotByPort(port)?.host;
  }

  getWorkspaceUrl(port: number): string | undefined {
    return this.slotManager.getSlotByPort(port)?.workspaceUrl;
  }

  async checkHealth(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://${this.healthCheckHost}:${port}/`, { timeout: 2000 }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async waitForHealthy(port: number, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const interval = 500;

    while (Date.now() - startTime < timeout) {
      const isHealthy = await this.checkHealth(port);
      if (isHealthy) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return false;
  }

  /**
   * Wait for OpenCode to finish internal initialization by checking that the
   * SQLite database has a valid project entry (worktree != '/').
   * Falls back to a fixed delay if the database file doesn't exist yet.
   */
  private async waitForProjectReady(dataDir: string, timeout: number = 10000): Promise<void> {
    const dbPath = path.join(dataDir, 'opencode', 'opencode.db');
    const startTime = Date.now();
    const interval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        if (fs.existsSync(dbPath)) {
          // Check file size as a rough indicator that DB has been written to
          const stats = fs.statSync(dbPath);
          if (stats.size > 4096) {
            console.log(`[OpenCode] Project DB ready (${stats.size} bytes) in ${Date.now() - startTime}ms`);
            // Give a small additional buffer for SQLite writes to flush
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
          }
        }
      } catch {
        // File might not exist yet, keep polling
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.warn(`[OpenCode] Project DB readiness check timed out after ${timeout}ms, proceeding anyway`);
  }
}
