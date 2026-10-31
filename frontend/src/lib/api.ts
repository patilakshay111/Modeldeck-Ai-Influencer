/**
 * Typed API client.
 *
 * One place knows the wire format. Every call carries the session token, and
 * a 401 clears the session so the app falls back to the sign-in screen rather
 * than failing silently.
 */

export type ModelTask =
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video"
  | "video-to-video"
  | "upscale-image"
  | "upscale-video"
  | "image-to-text";

export interface ModelSummary {
  key: string;
  displayName: string;
  task: ModelTask;
  /** False when the model cannot run on this host yet. */
  available: boolean;
  unavailableReason?: string;
  /** Credit charge per output tier, keyed by the tier name. */
  prices: Record<string, number>;
  /** Credit charge for one representative run. */
  defaultPrice?: number;
  /** Provider cost of that representative run, in USD. */
  defaultPriceUsd?: number;
  /** What the provider charges per output tier, in USD. */
  providerUsd: Record<string, number> | null;
  acceptsReferenceImages: boolean;
  acceptsPrompt: boolean;
  aspectRatios: string[];
  resolutions: string[];
  durations: string[];
  spicy?: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  balanceMillicredits: number;
  ageAttestedAt: number | null;
}

export interface CharacterReference {
  url: string;
  role:
    | "anchor"
    | "turnaround-front"
    | "turnaround-3-quarter-left"
    | "turnaround-3-quarter-right"
    | "turnaround-profile-left"
    | "turnaround-profile-right"
    | "turnaround-back"
    | "full-body-front"
    | "full-body-side";
  source: "upload" | "generated-multiple-angles" | "generated-full-body";
}

export interface Influencer {
  id: string;
  ownerId: string;
  handle: string;
  name: string;
  description: string;
  image: string;
  references: CharacterReference[];
  spec: string;
  version: number;
  kitStatus: "none" | "building" | "ready" | "failed";
  kitJobs: Array<{ modelKey: string; providerJobId: string; role: string }>;
  createdAt: number;
}

export interface CreateInfluencerInput {
  handle: string;
  name?: string;
  description?: string;
  image: string;
  buildKit?: boolean;
}

export interface Workflow {
  id: string;
  ownerId: string;
  name: string;
  modelKey: string;
  prompt: string;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Asset {
  url: string;
  contentType: string | null;
  isVideo: boolean;
}

/** A ready-made look. */
export interface CharacterTemplate {
  id: string;
  label: string;
  handle: string;
  src: string;
}

export type CanvasNodeKind = "image" | "video" | "text";
export type CanvasNodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  data: {
    model?: string;
    prompt?: string;
    aspect?: string;
    quality?: string;
    duration?: string;
    output?: string;
    outputKind?: "image" | "video";
    sourceNodeIds?: string[];
    jobId?: string;
    status?: CanvasNodeStatus;
    error?: string | null;
  };
}

export interface Canvas {
  id: string;
  name: string;
  nodes: CanvasNode[];
  createdAt: number;
  updatedAt: number;
}

// ── Agent ─────────────────────────────────────────────────────────────────

export type AgentJobStatus =
  | "planning"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export interface AgentPlan {
  kind: "image" | "video";
  model: string;
  prompt: string;
  duration: string | null;
  summary: string;
  steps: Array<{ id: string; label: string; status: string }>;
}

export interface AgentJob {
  id: string;
  chatId: string;
  status: AgentJobStatus;
  input: string;
  llmModel: string | null;
  plan: AgentPlan | null;
  outputs: Array<{ url: string; kind: "image" | "video" }>;
  steps: Array<{ id: string; label: string; status: string }>;
  providerJobId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgentChat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentMemory {
  id: string;
  key: string;
  value: string;
  createdAt: number;
}

export interface AgentSchedule {
  id: string;
  expression: string;
  input: string;
  enabled: boolean;
  lastRunAt: number | null;
  createdAt: number;
}

export interface JobStatus {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  modelKey: string;
  error: string | null;
  output: Asset[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = "modeldeck:token";

export const readToken = (): string | null => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const writeToken = (token: string | null): void => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable; the session simply will not persist */
  }
};

let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void): void => {
  onUnauthorized = handler;
};

const request = async <T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.json !== undefined) headers.set("content-type", "application/json");

  const token = readToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const response = await fetch(path, {
    ...init,
    headers,
    ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}),
  });

  const text = await response.text();
  const payload: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      writeToken(null);
      onUnauthorized?.();
    }
    const body = (payload ?? {}) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      body.error ?? null,
      body.message ?? `Request failed with HTTP ${response.status}.`,
    );
  }
  return payload as T;
};

export const api = {
  health: () => request<{ ok: boolean; providers: Record<string, boolean> }>("/api/health"),

  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: PublicUser }>("/api/auth/register", {
      method: "POST",
      json: { email, password, name },
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: PublicUser }>("/api/auth/login", {
      method: "POST",
      json: { email, password },
    }),

  me: () => request<{ user: PublicUser }>("/api/auth/me"),

  attestAge: () =>
    request<{ user: PublicUser }>("/api/users/age-check", {
      method: "POST",
      json: { confirmed: true },
    }),

  models: () =>
    request<{ models: ModelSummary[]; providers: Record<string, boolean> }>(
      "/api/studio/models",
    ),

  credits: () =>
    request<{ balanceMillicredits: number; balanceCredits: number }>(
      "/api/studio/credits",
    ),

  generate: (input: {
    modelKey: string;
    prompt?: string;
    images?: string[];
    aspectRatio?: string;
    resolution?: string;
    duration?: string;
  }) => request<{ jobId: string }>("/api/studio/generate", { method: "POST", json: input }),

  status: (jobId: string) => request<JobStatus>(`/api/studio/status/${jobId}`),

  library: () =>
    request<{
      assets: Array<
        Asset & { modelKey: string; prompt: string; jobId: string; createdAt: number }
      >;
    }>("/api/studio/library"),

  influencers: () =>
    request<{ influencers: Influencer[] }>("/api/studio/influencers"),

  influencer: (id: string) =>
    request<{ influencer: Influencer }>(`/api/studio/influencers/${id}`),

  createInfluencer: (input: CreateInfluencerInput) =>
    request<{ influencer: Influencer }>("/api/studio/influencers", { method: "POST", json: input }),

  deleteInfluencer: (id: string) =>
    request<{ ok: true }>(`/api/studio/influencers/${id}`, { method: "DELETE" }),

  workflows: () => request<{ workflows: Workflow[] }>("/api/studio/workflows"),

  createWorkflow: (input: {
    name: string;
    modelKey: string;
    prompt: string;
    settings: Record<string, unknown>;
  }) => request<{ workflow: Workflow }>("/api/studio/workflows", { method: "POST", json: input }),

  deleteWorkflow: (id: string) =>
    request<{ ok: true }>(`/api/studio/workflows/${id}`, { method: "DELETE" }),

  // ── Ready-made looks ─────────────────────────────────────────────────────

  templates: () =>
    request<{ templates: CharacterTemplate[] }>("/api/studio/templates"),

  claimTemplate: (id: string) =>
    request<{ influencer: Influencer }>(
      `/api/studio/templates/${id}/claim`,
      { method: "POST" },
    ),

  // ── Canvases ─────────────────────────────────────────────────────────────

  canvases: () => request<{ canvases: Canvas[] }>("/api/studio/canvases"),

  createCanvas: (name: string) =>
    request<{ canvas: Canvas }>("/api/studio/canvases", {
      method: "POST",
      json: { name },
    }),

  canvas: (id: string) =>
    request<{ canvas: Canvas }>(`/api/studio/canvases/${id}`),

  saveCanvas: (id: string, patch: { name?: string; nodes?: CanvasNode[] }) =>
    request<{ canvas: Canvas }>(`/api/studio/canvases/${id}`, {
      method: "PATCH",
      json: patch,
    }),

  deleteCanvas: (id: string) =>
    request<{ ok: true }>(`/api/studio/canvases/${id}`, { method: "DELETE" }),

  runCanvasNode: (id: string, nodeId: string) =>
    request<{ jobId: string; canvas: Canvas }>(
      `/api/studio/canvases/${id}/run`,
      { method: "POST", json: { nodeId } },
    ),

  canvasNode: (id: string, nodeId: string) =>
    request<{ node: CanvasNode }>(`/api/studio/canvases/${id}/node/${nodeId}`),

  // ── Agent ────────────────────────────────────────────────────────────────

  agentChats: () => request<{ chats: AgentChat[] }>("/api/agent/chats"),

  createAgentChat: (title: string) =>
    request<{ chat: AgentChat }>("/api/agent/chats", {
      method: "POST",
      json: { title },
    }),

  agentChat: (id: string) =>
    request<{ chat: AgentChat; jobs: AgentJob[] }>(`/api/agent/chats/${id}`),

  deleteAgentChat: (id: string) =>
    request<{ ok: true }>(`/api/agent/chats/${id}`, { method: "DELETE" }),

  agentPlanners: () =>
    request<{
      models: Array<{ id: string; label: string; provider: string }>;
      configured: boolean;
    }>("/api/agent/llms"),

  agentPlan: (input: {
    chatId: string;
    input: string;
    llmModel?: string;
    autoRun?: boolean;
  }) =>
    request<{
      job: AgentJob;
      plannerError: string | null;
      costCredits: number;
    }>("/api/agent/plan", { method: "POST", json: input }),

  agentJob: (id: string) => request<{ job: AgentJob }>(`/api/agent/jobs/${id}`),

  approveAgentJob: (
    id: string,
    input: { model?: string; duration?: string; prompt?: string } = {},
  ) =>
    request<{ job: AgentJob }>(`/api/agent/jobs/${id}/approve`, {
      method: "POST",
      json: input,
    }),

  stopAgentJob: (id: string) =>
    request<{ job: AgentJob }>(`/api/agent/jobs/${id}/stop`, {
      method: "POST",
      json: {},
    }),

  agentSkills: () =>
    request<{ skills: Array<{ id: string; name: string; description: string }> }>(
      "/api/agent/skills",
    ),

  agentMemories: () =>
    request<{ memories: AgentMemory[] }>("/api/agent/memories"),

  saveAgentMemory: (key: string, value: string) =>
    request<{ memory: AgentMemory }>("/api/agent/memories", {
      method: "POST",
      json: { key, value },
    }),

  deleteAgentMemory: (id: string) =>
    request<{ ok: true }>(`/api/agent/memories/${id}`, { method: "DELETE" }),

  agentSchedules: () =>
    request<{ schedules: AgentSchedule[] }>("/api/agent/schedules"),

  createAgentSchedule: (expression: string, input: string) =>
    request<{ schedule: AgentSchedule }>("/api/agent/schedules", {
      method: "POST",
      json: { expression, input },
    }),

  toggleAgentSchedule: (id: string) =>
    request<{ schedule: AgentSchedule }>(`/api/agent/schedules/${id}/toggle`, {
      method: "POST",
      json: {},
    }),

  deleteAgentSchedule: (id: string) =>
    request<{ ok: true }>(`/api/agent/schedules/${id}`, { method: "DELETE" }),
};
