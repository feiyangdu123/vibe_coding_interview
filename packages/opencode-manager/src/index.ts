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

export class OpenCodeManager {
  private slotManager: SlotManager;
  private instances: Map<string, InstanceInfo>;
  private opencodePath: string;
  private bindHost: string;
  private healthCheckHost: string;

  constructor(opencodePath: string = 'opencode') {
    this.bindHost = process.env.OPENCODE_BIND_HOST || '127.0.0.1';
    this.healthCheckHost = this.bindHost === '0.0.0.0' ? '127.0.0.1' : this.bindHost;
    this.slotManager = new SlotManager(parseSlots(process.env.OPENCODE_SLOTS), this.bindHost);
    this.instances = new Map();
    this.opencodePath = opencodePath;
  }

  /**
   * Initialize port manager with ports from active interviews in database
   */
  initializeWithActivePorts(activePorts: number[]): void {
    activePorts.forEach(port => {
      this.slotManager.markUsed(port);
    });
  }

  async startInstance(interviewId: string, workDir: string): Promise<{ host: string; workspaceUrl: string; port: number; processId: number; dataDir: string }> {
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

    const child = spawn(this.opencodePath, [
      'serve',
      '--port', slot.port.toString(),
      '--hostname', this.bindHost
    ], {
      env: { ...process.env, XDG_DATA_HOME: dataDir },
      cwd: workDir,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.on('error', (error) => {
      console.error('Failed to spawn OpenCode:', error);
      console.error('Path:', this.opencodePath);
      console.error('WorkDir:', workDir);
      this.slotManager.release(slot.port);
    });

    child.stderr?.on('data', (data) => {
      console.error('OpenCode stderr:', data.toString());
    });

    child.stdout?.on('data', (data) => {
      console.log('OpenCode stdout:', data.toString());
    });

    if (!child.pid) {
      this.slotManager.release(slot.port);
      throw new Error('Failed to start OpenCode instance');
    }

    const instanceInfo: InstanceInfo = {
      interviewId,
      host: slot.host,
      workspaceUrl: slot.workspaceUrl,
      port: slot.port,
      processId: child.pid,
      process: child,
      workDir,
      dataDir,
      startedAt: new Date()
    };

    this.instances.set(interviewId, instanceInfo);

    child.on('exit', () => {
      this.instances.delete(interviewId);
      this.slotManager.release(slot.port);
    });

    // Wait for health check
    const isHealthy = await this.waitForHealthy(slot.port);
    if (!isHealthy) {
      // Cleanup on failure
      try {
        child.kill();
      } catch (e) {
        // Ignore
      }
      this.instances.delete(interviewId);
      this.slotManager.release(slot.port);
      throw new Error(`OpenCode instance failed to start on port ${slot.port}`);
    }

    return {
      host: slot.host,
      workspaceUrl: slot.workspaceUrl,
      port: slot.port,
      processId: child.pid,
      dataDir
    };
  }

  async stopInstance(interviewId: string): Promise<void> {
    const instance = this.instances.get(interviewId);
    if (!instance) {
      return;
    }

    try {
      instance.process.kill();
    } catch (error) {
      console.error(`Failed to kill process ${instance.processId}:`, error);
    }

    this.instances.delete(interviewId);
    this.slotManager.release(instance.port);
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
}
