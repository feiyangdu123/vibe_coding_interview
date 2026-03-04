export interface ControlPlaneConfig {
  host: string;
  port: number;
  portalOrigin: string;
  workspaceRoot: string;
  workspaceBasePort: number;
  workspaceMaxSessions: number;
  opencodeBinary: string;
  opencodeUsername: string;
  defaultTemplatePath: string | null;
}

export interface PortalConfig {
  controlPlaneOrigin: string;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function loadControlPlaneConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  return {
    host: env.CONTROL_PLANE_HOST ?? "127.0.0.1",
    port: parseInteger(env.CONTROL_PLANE_PORT, 4000),
    portalOrigin: env.PORTAL_ORIGIN ?? "http://127.0.0.1:3000",
    workspaceRoot: env.WORKSPACE_ROOT ?? "/tmp/vibe-interview-workspaces",
    workspaceBasePort: parseInteger(env.WORKSPACE_BASE_PORT, 4100),
    workspaceMaxSessions: parseInteger(env.WORKSPACE_MAX_SESSIONS, 5),
    opencodeBinary: env.OPENCODE_BIN ?? "opencode",
    opencodeUsername: env.OPENCODE_SERVER_USERNAME ?? "opencode",
    defaultTemplatePath: env.DEFAULT_TEMPLATE_PATH?.trim() || null,
  };
}

export function loadPortalConfig(env: NodeJS.ProcessEnv = process.env): PortalConfig {
  return {
    controlPlaneOrigin: env.NEXT_PUBLIC_CONTROL_PLANE_ORIGIN ?? "http://127.0.0.1:4000",
  };
}
