import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as http from 'http';
import * as fs from 'fs';

export interface InstanceInfo {
  interviewId: string;
  port: number;
  processId: number;
  process: ChildProcess;
  workDir: string;
  dataDir: string;
  startedAt: Date;
}

export interface LaunchConfig {
  interviewId: string;
  port: number;
  workDir: string;
}

class PortManager {
  private readonly MIN_PORT = 4100;
  private readonly MAX_PORT = 4200;
  private usedPorts: Set<number> = new Set();

  async allocate(): Promise<number> {
    for (let port = this.MIN_PORT; port <= this.MAX_PORT; port++) {
      if (!this.usedPorts.has(port) && await this.isPortAvailable(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available ports in range 4100-4200');
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

      server.listen(port, '127.0.0.1');
    });
  }

  release(port: number): void {
    this.usedPorts.delete(port);
  }

  markUsed(port: number): void {
    this.usedPorts.add(port);
  }
}

export class OpenCodeManager {
  private portManager: PortManager;
  private instances: Map<string, InstanceInfo>;
  private opencodePath: string;

  constructor(opencodePath: string = 'opencode') {
    this.portManager = new PortManager();
    this.instances = new Map();
    this.opencodePath = opencodePath;
  }

  /**
   * Initialize port manager with ports from active interviews in database
   */
  initializeWithActivePorts(activePorts: number[]): void {
    activePorts.forEach(port => {
      this.portManager.markUsed(port);
    });
  }

  async startInstance(interviewId: string, workDir: string): Promise<{ port: number; processId: number; dataDir: string }> {
    if (this.instances.has(interviewId)) {
      const existing = this.instances.get(interviewId)!;
      return { port: existing.port, processId: existing.processId, dataDir: existing.dataDir };
    }

    const port = await this.portManager.allocate();
    const homeDir = os.homedir();
    const dataDir = path.join(homeDir, '.local', 'share', `opencode-${interviewId}`);

    // Create unique data directory for this interview
    fs.mkdirSync(dataDir, { recursive: true });

    const child = spawn(this.opencodePath, [
      'serve',
      '--port', port.toString(),
      '--hostname', '127.0.0.1'
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
      this.portManager.release(port);
    });

    child.stderr?.on('data', (data) => {
      console.error('OpenCode stderr:', data.toString());
    });

    child.stdout?.on('data', (data) => {
      console.log('OpenCode stdout:', data.toString());
    });

    if (!child.pid) {
      this.portManager.release(port);
      throw new Error('Failed to start OpenCode instance');
    }

    const instanceInfo: InstanceInfo = {
      interviewId,
      port,
      processId: child.pid,
      process: child,
      workDir,
      dataDir,
      startedAt: new Date()
    };

    this.instances.set(interviewId, instanceInfo);

    child.on('exit', () => {
      this.instances.delete(interviewId);
      this.portManager.release(port);
    });

    // Wait for health check
    const isHealthy = await this.waitForHealthy(port);
    if (!isHealthy) {
      // Cleanup on failure
      try {
        child.kill();
      } catch (e) {
        // Ignore
      }
      this.instances.delete(interviewId);
      this.portManager.release(port);
      throw new Error(`OpenCode instance failed to start on port ${port}`);
    }

    return { port, processId: child.pid, dataDir };
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
    this.portManager.release(instance.port);
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

  async checkHealth(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 2000 }, (res) => {
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
