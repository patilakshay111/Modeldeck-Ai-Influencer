/**
 * The agent.
 *
 * ModelDeck does not have a chat box that generates images.
 * It has a **plan, approve, run** pipeline:
 *
 *   1. you write what you want in a chat
 *   2. an LLM turns it into a plan — which model, what prompt, how long
 *   3. the plan comes back for approval, with the model and duration editable
 *   4. you approve it and it runs
 *   5. the outputs land back in the chat
 *
 * Around that sit memories (facts the agent remembers), skills (what it can
 * do), schedules (recurring jobs) and connectors (external services).
 *
 * This module owns the same shape. The planner uses an LLM when one is
 * configured and falls back to a deterministic reading of the request when
 * none is, so the pipeline works without a second provider key.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { findModel, MODELS } from "../models/registry.js";
import { priceRun } from "../models/pricing.js";

export type AgentJobStatus =
  | "planning"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "stopped";

export interface AgentPlan {
  /** What the plan will make. */
  kind: "image" | "video";
  /** Model key from the registry. */
  model: string;
  /** The prompt the plan will send. */
  prompt: string;
  /** Video duration in seconds, when the kind is video. */
  duration: string | null;
  /** One line the agent says about the plan. */
  summary: string;
  /** The steps the plan will take. */
  steps: Array<{ id: string; label: string; status: string }>;
}

export interface AgentJob {
  id: string;
  chatId: string;
  /** The account the job runs for. */
  ownerId: string;
  status: AgentJobStatus;
  input: string;
  llmModel: string | null;
  plan: AgentPlan | null;
  outputs: Array<{ url: string; kind: "image" | "video" }>;
  /** The steps of the plan, with their state. */
  steps: Array<{ id: string; label: string; status: string }>;
  /** The studio job that carries out the plan. */
  providerJobId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgentChat {
  id: string;
  ownerId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentMemory {
  id: string;
  ownerId: string;
  key: string;
  value: string;
  createdAt: number;
}

export interface AgentSchedule {
  id: string;
  ownerId: string;
  /** A cron-like expression, kept as written. */
  expression: string;
  /** What the agent should do when it fires. */
  input: string;
  enabled: boolean;
  lastRunAt: number | null;
  createdAt: number;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
}

interface AgentFile {
  version: 1;
  chats: AgentChat[];
  jobs: AgentJob[];
  memories: AgentMemory[];
  schedules: AgentSchedule[];
}

/** The skills the agent advertises. The reference exposes the same list. */
export const AGENT_SKILLS: readonly AgentSkill[] = [
  {
    id: "skill-generate-image",
    name: "Generate an image",
    description:
      "Turn a described scene into a still, with a model chosen for the style.",
  },
  {
    id: "skill-generate-video",
    name: "Generate a video",
    description:
      "Turn a described scene into a clip, optionally starting from a still.",
  },
  {
    id: "skill-character",
    name: "Use a character",
    description:
      "Mention a saved character with @name to keep their face across a generation.",
  },
  {
    id: "skill-upscale",
    name: "Upscale",
    description: "Raise the resolution of a still or a clip.",
  },
  {
    id: "skill-canvas",
    name: "Build a canvas",
    description:
      "Chain several steps on a board, so one result feeds the next.",
  },
];

const now = () => Date.now();
const id = (prefix: string) => `${prefix}_${randomBytes(10).toString("hex")}`;

export class AgentStore {
  private readonly path: string;
  private file: AgentFile;

  constructor(path: string) {
    this.path = path;
    try {
      this.file = JSON.parse(readFileSync(path, "utf8")) as AgentFile;
    } catch {
      this.file = { version: 1, chats: [], jobs: [], memories: [], schedules: [] };
    }
    if (!Array.isArray(this.file.chats)) this.file.chats = [];
    if (!Array.isArray(this.file.jobs)) this.file.jobs = [];
    if (!Array.isArray(this.file.memories)) this.file.memories = [];
    if (!Array.isArray(this.file.schedules)) this.file.schedules = [];
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.file, null, 1), "utf8");
  }

  // ── Chats ───────────────────────────────────────────────────────────────

  listChats(ownerId: string): AgentChat[] {
    return this.file.chats
      .filter((chat) => chat.ownerId === ownerId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getChat(ownerId: string, chatId: string): AgentChat | undefined {
    return this.file.chats.find(
      (chat) => chat.id === chatId && chat.ownerId === ownerId,
    );
  }

  createChat(ownerId: string, title: string): AgentChat {
    const chat: AgentChat = {
      id: id("chat"),
      ownerId,
      title: title.trim() || "New chat",
      createdAt: now(),
      updatedAt: now(),
    };
    this.file.chats.push(chat);
    this.persist();
    return chat;
  }

  deleteChat(ownerId: string, chatId: string): boolean {
    const index = this.file.chats.findIndex(
      (chat) => chat.id === chatId && chat.ownerId === ownerId,
    );
    if (index < 0) return false;
    this.file.chats.splice(index, 1);
    this.file.jobs = this.file.jobs.filter((job) => job.chatId !== chatId);
    this.persist();
    return true;
  }

  // ── Jobs ────────────────────────────────────────────────────────────────

  listJobs(ownerId: string, chatId?: string): AgentJob[] {
    const chatIds = new Set(
      chatId ? [chatId] : this.listChats(ownerId).map((chat) => chat.id),
    );
    return this.file.jobs
      .filter((job) => chatIds.has(job.chatId))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getJob(ownerId: string, jobId: string): AgentJob | undefined {
    const job = this.file.jobs.find((entry) => entry.id === jobId);
    if (!job) return undefined;
    const chat = this.file.chats.find(
      (entry) => entry.id === job.chatId && entry.ownerId === ownerId,
    );
    return chat ? job : undefined;
  }

  createJob(job: AgentJob): AgentJob {
    this.file.jobs.push(job);
    const chat = this.file.chats.find((entry) => entry.id === job.chatId);
    if (chat) chat.updatedAt = now();
    this.persist();
    return job;
  }

  updateJob(jobId: string, patch: Partial<AgentJob>): AgentJob | undefined {
    const job = this.file.jobs.find((entry) => entry.id === jobId);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: now() });
    this.persist();
    return job;
  }

  // ── Memories ────────────────────────────────────────────────────────────

  listMemories(ownerId: string): AgentMemory[] {
    return this.file.memories
      .filter((memory) => memory.ownerId === ownerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  saveMemory(
    ownerId: string,
    input: { key: string; value: string },
  ): AgentMemory {
    const existing = this.file.memories.find(
      (memory) => memory.ownerId === ownerId && memory.key === input.key.trim(),
    );
    if (existing) {
      existing.value = input.value;
      this.persist();
      return existing;
    }
    const memory: AgentMemory = {
      id: id("mem"),
      ownerId,
      key: input.key.trim(),
      value: input.value,
      createdAt: now(),
    };
    this.file.memories.push(memory);
    this.persist();
    return memory;
  }

  deleteMemory(ownerId: string, memoryId: string): boolean {
    const index = this.file.memories.findIndex(
      (memory) => memory.id === memoryId && memory.ownerId === ownerId,
    );
    if (index < 0) return false;
    this.file.memories.splice(index, 1);
    this.persist();
    return true;
  }

  // ── Schedules ───────────────────────────────────────────────────────────

  listSchedules(ownerId: string): AgentSchedule[] {
    return this.file.schedules
      .filter((schedule) => schedule.ownerId === ownerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  createSchedule(
    ownerId: string,
    input: { expression: string; input: string },
  ): AgentSchedule {
    const schedule: AgentSchedule = {
      id: id("sch"),
      ownerId,
      expression: input.expression.trim(),
      input: input.input.trim(),
      enabled: true,
      lastRunAt: null,
      createdAt: now(),
    };
    this.file.schedules.push(schedule);
    this.persist();
    return schedule;
  }

  toggleSchedule(ownerId: string, scheduleId: string): AgentSchedule | undefined {
    const schedule = this.file.schedules.find(
      (entry) => entry.id === scheduleId && entry.ownerId === ownerId,
    );
    if (!schedule) return undefined;
    schedule.enabled = !schedule.enabled;
    this.persist();
    return schedule;
  }

  deleteSchedule(ownerId: string, scheduleId: string): boolean {
    const index = this.file.schedules.findIndex(
      (schedule) => schedule.id === scheduleId && schedule.ownerId === ownerId,
    );
    if (index < 0) return false;
    this.file.schedules.splice(index, 1);
    this.persist();
    return true;
  }
}

/**
 * A deterministic reading of a request, used when no LLM is configured and
 * as the fallback when the LLM's answer does not name a usable model.
 */
export const fallbackPlan = (
  input: string,
  characters: readonly string[] = [],
): AgentPlan => {
  const text = input.trim();
  const wantsVideo =
    /\b(video|clip|animate|motion|footage|film)\b/i.test(text);
  const mentions = characters.filter((handle) =>
    new RegExp(`@${handle}\\b`, "i").test(text),
  );

  const kind: AgentPlan["kind"] = wantsVideo ? "video" : "image";
  const candidates = MODELS.filter(
    (model) =>
      model.available &&
      (wantsVideo
        ? model.task === "image-to-video" || model.task === "text-to-video"
        : model.task === "text-to-image"),
  );
  const model =
    candidates.find((entry) => entry.key === "flux-2-max") ??
    candidates[0] ??
    MODELS.find((entry) => entry.available);

  const prompt = mentions.length
    ? `${text} — keep ${mentions.map((handle) => `@${handle}`).join(", ")} consistent.`
    : text;

  return {
    kind,
    model: model?.key ?? "flux-2-max",
    prompt,
    duration: wantsVideo ? "5" : null,
    summary: wantsVideo
      ? `A ${model?.displayName ?? "video"} clip: ${text.split(". ")[0] ?? text}`
      : `A ${model?.displayName ?? "still"}: ${text.split(". ")[0] ?? text}`,
    steps: [
      { id: "step-1", label: "Plan the shot", status: "done" },
      {
        id: "step-2",
        label: wantsVideo ? "Render the clip" : "Render the still",
        status: "pending",
      },
    ],
  };
};

/** The cost of a plan, so the agent can show it before the run. */
export const planCost = (plan: AgentPlan): number => {
  const model = findModel(plan.model);
  if (!model) return 0;
  return priceRun(model, {
    resolution: model.resolutions[0],
    durationSeconds: plan.duration ? Number(plan.duration) : undefined,
  }).credits;
};
