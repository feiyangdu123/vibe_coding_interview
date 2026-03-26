import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenCodeManager, buildLaunchSessionUrl, encodeWorkspaceSlug } from '../src/index';

function createManager() {
  const manager = new OpenCodeManager('opencode');
  (manager as unknown as {
    slotManager: { getSlotByPort(port: number): { host: string; port: number; workspaceUrl: string } | undefined };
  }).slotManager = {
    getSlotByPort(port: number) {
      if (port !== 4100) {
        return undefined;
      }

      return {
        host: 'demo.example.com',
        port,
        workspaceUrl: 'https://demo.example.com:4100'
      };
    }
  };
  return manager;
}

test('reuses the latest root session when one already exists', async () => {
  const manager = createManager();
  let createCalls = 0;

  (manager as unknown as {
    listRootSessions(port: number, workDir: string): Promise<Array<{ id: string; directory: string }>>;
    createRootSession(port: number): Promise<{ id: string; directory: string }>;
  }).listRootSessions = async (_port, workDir) => [{ id: 'ses_existing', directory: workDir }];
  (manager as unknown as {
    createRootSession(port: number): Promise<{ id: string; directory: string }>;
  }).createRootSession = async () => {
    createCalls += 1;
    return { id: 'ses_new', directory: '/tmp/unused' };
  };

  const result = await manager.ensureLaunchSession('int_existing', 4100, '/tmp/interview-workdir', {
    timeoutMs: 10,
    intervalMs: 0
  });

  assert.equal(result.sessionId, 'ses_existing');
  assert.equal(result.sessionUrl, 'https://demo.example.com:4100/L3RtcC9pbnRlcnZpZXctd29ya2Rpcg/session/ses_existing');
  assert.equal(createCalls, 0);
});

test('creates a new root session when the directory has none', async () => {
  const manager = createManager();
  const workDir = '/tmp/interview-workdir';

  (manager as unknown as {
    listRootSessions(port: number, workDir: string): Promise<Array<{ id: string; directory: string }>>;
    createRootSession(port: number): Promise<{ id: string; directory: string }>;
  }).listRootSessions = async () => [];
  (manager as unknown as {
    createRootSession(port: number): Promise<{ id: string; directory: string }>;
  }).createRootSession = async () => ({ id: 'ses_created', directory: workDir });

  const result = await manager.ensureLaunchSession('int_create', 4100, workDir, {
    timeoutMs: 10,
    intervalMs: 0
  });

  assert.equal(result.sessionId, 'ses_created');
  assert.equal(result.sessionUrl, 'https://demo.example.com:4100/L3RtcC9pbnRlcnZpZXctd29ya2Rpcg/session/ses_created');
});

test('encodes deep-link workspace paths with URL-safe base64', () => {
  const workDir = '/tmp/候选 人';
  const encoded = 'L3RtcC_lgJnpgIkg5Lq6';

  assert.equal(encodeWorkspaceSlug(workDir), encoded);
  assert.equal(
    buildLaunchSessionUrl('https://demo.example.com:4100', workDir, 'ses_unicode'),
    `https://demo.example.com:4100/${encoded}/session/ses_unicode`
  );
});
