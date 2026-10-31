/**
 * Agent routes.
 *
 * The endpoint shape follows:
 *
 *   GET    /api/agent/chats                  list chats
 *   POST   /api/agent/chats                  create a chat
 *   GET    /api/agent/chats/:id              one chat
 *   DELETE /api/agent/chats/:id              delete a chat
 *   GET    /api/agent/llms                   the planners available
 *   POST   /api/agent/plan                   plan a job from a request
 *   GET    /api/agent/jobs                   jobs, optionally for one chat
 *   GET    /api/agent/jobs/:id               one job
 *   POST   /api/agent/jobs/:id/approve       approve a plan and run it
 *   POST   /api/agent/jobs/:id/stop          stop a running job
 *   DELETE /api/agent/outputs                delete one output
 *   GET    /api/agent/skills                 what the agent can do
 *   GET    /api/agent/memories               list memories
 *   POST   /api/agent/memories               save a memory
 *   DELETE /api/agent/memories/:id           delete a memory
 *   GET    /api/agent/connectors             list connectors
 *   GET    /api/agent/connectors/:p/start    start a connector
 *   DELETE /api/agent/connectors/:p           disconnect a connector
 *   GET    /api/agent/schedules              list schedules
 *   POST   /api/agent/schedules              create a schedule
 *   POST   /api/agent/schedules/:id/toggle   toggle a schedule
 *   DELETE /api/agent/schedules/:id          delete a schedule
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { requireUser } from "./auth.js";
import { findModel } from "../models/registry.js";
import {
  AGENT_SKILLS,
  fallbackPlan,
  planCost,
  type AgentJob,
  type AgentPlan,
} from "../agent/store.js";
import { PLANNER_MODELS, planWithLlm } from "../agent/planner.js";
import { ProviderError } from "../providers/types.js";

const planSchema = z.object({
  chatId: z.string().min(1),
  input: z.string().min(1).max(20_000),
  llmModel: z.string().max(80).optional(),
  autoRun: z.boolean().optional(),
});

const approveSchema = z.object({
  model: z.string().max(64).optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  prompt: z.string().max(20_000).optional(),
});

const memorySchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().max(4_000),
});

const scheduleSchema = z.object({
  expression: z.string().min(1).max(120),
  input: z.string().min(1).max(20_000),
});

const CONNECTORS = [
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Read images and clips from your Drive.",
    available: false,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Read images and clips from your Dropbox.",
    available: false,
  },
  {
    id: "notion",
    name: "Notion",
    description: "Take prompts from a Notion page.",
    available: false,
  },
] as const;

export const registerAgentRoutes = (
  app: FastifyInstance,
  context: AppContext,
): void => {
  const plannerConfig = () => ({
    openaiKey: context.config.OPENAI_API_KEY,
    anthropicKey: context.config.ANTHROPIC_API_KEY,
    model: context.config.AGENT_MODEL,
  });

  // ── Chats ───────────────────────────────────────────────────────────────

  app.get("/api/agent/chats", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ chats: context.agent.listChats(user.id) });
  });

  app.post("/api/agent/chats", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = z
      .object({ title: z.string().max(200).optional() })
      .safeParse(request.body ?? {});
    const chat = context.agent.createChat(
      user.id,
      parsed.success ? (parsed.data.title ?? "") : "",
    );
    return reply.code(201).send({ chat });
  });

  app.get("/api/agent/chats/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const chat = context.agent.getChat(user.id, id);
    if (!chat) {
      return reply.code(404).send({ error: "not_found", message: "Unknown chat." });
    }
    return reply.send({
      chat,
      jobs: context.agent.listJobs(user.id, id),
    });
  });

  app.delete("/api/agent/chats/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const removed = context.agent.deleteChat(user.id, id);
    if (!removed) {
      return reply.code(404).send({ error: "not_found", message: "Unknown chat." });
    }
    return reply.send({ ok: true });
  });

  // ── Planners ────────────────────────────────────────────────────────────

  app.get("/api/agent/llms", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const config = plannerConfig();
    return reply.send({
      models: PLANNER_MODELS.filter((entry) =>
        entry.provider === "openai"
          ? Boolean(config.openaiKey)
          : Boolean(config.anthropicKey),
      ),
      configured: Boolean(config.openaiKey || config.anthropicKey),
    });
  });

  // ── Plan ────────────────────────────────────────────────────────────────

  app.post("/api/agent/plan", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const chat = context.agent.getChat(user.id, parsed.data.chatId);
    if (!chat) {
      return reply.code(404).send({ error: "not_found", message: "Unknown chat." });
    }
    const characters = context.collections
      .listInfluencers(user.id)
      .map((entry) => ({ handle: entry.handle, name: entry.name }));
    const memories = context.agent
      .listMemories(user.id)
      .map((entry) => ({ key: entry.key, value: entry.value }));

    let plan: AgentPlan | null = null;
    let plannerError: string | null = null;
    try {
      plan = await planWithLlm(
        { ...plannerConfig(), model: parsed.data.llmModel },
        { input: parsed.data.input, memories, characters },
      );
    } catch (cause) {
      plannerError =
        cause instanceof Error ? cause.message : "The planner could not be reached.";
    }
    if (!plan) plan = fallbackPlan(parsed.data.input, characters.map((c) => c.handle));
    // A plan that names a model this service does not have is not usable.
    if (!findModel(plan.model)) {
      plan = fallbackPlan(parsed.data.input, characters.map((c) => c.handle));
    }

    const job: AgentJob = {
      id: `job_${Math.random().toString(16).slice(2, 12)}`,
      chatId: chat.id,
      ownerId: user.id,
      status: parsed.data.autoRun ? "running" : "awaiting_approval",
      input: parsed.data.input,
      llmModel: parsed.data.llmModel ?? null,
      plan,
      outputs: [],
      providerJobId: null,
      steps: plan.steps.map((step, index) => ({
        ...step,
        status: index === 0 ? "done" : "pending",
      })),
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    context.agent.createJob(job);

    if (parsed.data.autoRun) {
      await runJob(context, job, plan);
    }
    const current = context.agent.getJob(user.id, job.id);
    return reply.code(201).send({
      job: current ?? job,
      plannerError,
      usedFallback: plannerError !== null || plan !== null,
      costCredits: planCost(plan),
    });
  });

  // ── Jobs ────────────────────────────────────────────────────────────────

  app.get("/api/agent/jobs", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { chatId } = request.query as { chatId?: string };
    return reply.send({ jobs: context.agent.listJobs(user.id, chatId) });
  });

  app.get("/api/agent/jobs/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const job = context.agent.getJob(user.id, id);
    if (!job) {
      return reply.code(404).send({ error: "not_found", message: "Unknown job." });
    }
    await syncJob(context, job);
    return reply.send({ job: context.agent.getJob(user.id, id) });
  });

  app.post("/api/agent/jobs/:id/approve", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const job = context.agent.getJob(user.id, id);
    if (!job) {
      return reply.code(404).send({ error: "not_found", message: "Unknown job." });
    }
    const parsed = approveSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const plan: AgentPlan = {
      ...(job.plan ?? fallbackPlan(job.input)),
      ...(parsed.data.model ? { model: parsed.data.model } : {}),
      ...(parsed.data.prompt ? { prompt: parsed.data.prompt } : {}),
      ...(parsed.data.duration !== undefined
        ? { duration: String(parsed.data.duration) }
        : {}),
    };
    if (!findModel(plan.model)) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: `Unknown model "${plan.model}".` });
    }
    const updated = context.agent.updateJob(job.id, {
      plan,
      status: "running",
      error: null,
    });
    await runJob(context, updated ?? job, plan);
    await syncJob(context, context.agent.getJob(user.id, job.id) ?? job);
    return reply.send({ job: context.agent.getJob(user.id, job.id) });
  });

  app.post("/api/agent/jobs/:id/stop", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const job = context.agent.getJob(user.id, id);
    if (!job) {
      return reply.code(404).send({ error: "not_found", message: "Unknown job." });
    }
    const updated = context.agent.updateJob(job.id, { status: "stopped" });
    return reply.send({ job: updated });
  });

  app.delete("/api/agent/outputs", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { chatId, url } = request.query as { chatId?: string; url?: string };
    if (!chatId || !url) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: "chatId and url are required." });
    }
    const job = context.agent
      .listJobs(user.id, chatId)
      .find((entry) => entry.outputs.some((output) => output.url === url));
    if (job) {
      context.agent.updateJob(job.id, {
        outputs: job.outputs.filter((output) => output.url !== url),
      });
    }
    return reply.send({ ok: true });
  });

  // ── Skills ──────────────────────────────────────────────────────────────

  app.get("/api/agent/skills", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ skills: AGENT_SKILLS });
  });

  // ── Memories ────────────────────────────────────────────────────────────

  app.get("/api/agent/memories", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ memories: context.agent.listMemories(user.id) });
  });

  app.post("/api/agent/memories", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = memorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const memory = context.agent.saveMemory(user.id, parsed.data);
    return reply.code(201).send({ memory });
  });

  app.delete("/api/agent/memories/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const removed = context.agent.deleteMemory(user.id, id);
    if (!removed) {
      return reply.code(404).send({ error: "not_found", message: "Unknown memory." });
    }
    return reply.send({ ok: true });
  });

  // ── Connectors ──────────────────────────────────────────────────────────

  app.get("/api/agent/connectors", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ connectors: CONNECTORS });
  });

  app.get("/api/agent/connectors/:provider/start", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { provider } = request.params as { provider: string };
    const connector = CONNECTORS.find((entry) => entry.id === provider);
    if (!connector) {
      return reply
        .code(404)
        .send({ error: "not_found", message: "Unknown connector." });
    }
    return reply.code(501).send({
      error: "connector_unavailable",
      message: `${connector.name} needs its own OAuth application. This service does not ship one.`,
    });
  });

  app.delete("/api/agent/connectors/:provider", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ ok: true });
  });

  // ── Schedules ───────────────────────────────────────────────────────────

  app.get("/api/agent/schedules", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ schedules: context.agent.listSchedules(user.id) });
  });

  app.post("/api/agent/schedules", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = scheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const schedule = context.agent.createSchedule(user.id, parsed.data);
    return reply.code(201).send({ schedule });
  });

  app.post("/api/agent/schedules/:id/toggle", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const schedule = context.agent.toggleSchedule(user.id, id);
    if (!schedule) {
      return reply.code(404).send({ error: "not_found", message: "Unknown schedule." });
    }
    return reply.send({ schedule });
  });

  app.delete("/api/agent/schedules/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const removed = context.agent.deleteSchedule(user.id, id);
    if (!removed) {
      return reply.code(404).send({ error: "not_found", message: "Unknown schedule." });
    }
    return reply.send({ ok: true });
  });
};

/**
 * Copy the studio job's result into the agent job.
 *
 * The agent does not run generations itself — it submits them through the same
 * studio route, so the cost, the models and the storage are identical. This
 * reads the studio job back and folds its state and outputs into the agent's
 * own record.
 */
const syncJob = async (
  context: AppContext,
  job: AgentJob,
): Promise<void> => {
  if (job.status !== "running") return;
  if (!job.providerJobId) return;
  const providerJob = context.jobs.getForUser(job.providerJobId, job.ownerId);
  if (!providerJob) return;

  if (providerJob.state === "completed") {
    context.agent.updateJob(job.id, {
      status: "completed",
      outputs: providerJob.assets.map((asset) => ({
        url: asset.url,
        kind: asset.isVideo ? "video" : "image",
      })),
      steps: (job.plan?.steps ?? []).map((step) => ({ ...step, status: "done" })),
    });
    return;
  }
  if (providerJob.state === "failed") {
    context.agent.updateJob(job.id, {
      status: "failed",
      error: providerJob.error ?? "The run failed.",
    });
  }
};

/**
 * Run an approved plan.
 *
 * The plan is submitted to the model provider exactly as a direct generation
 * would be, so the agent and the studio cost the same and behave the same.
 */
const runJob = async (
  context: AppContext,
  job: AgentJob,
  plan: AgentPlan,
): Promise<void> => {
  const model = findModel(plan.model);
  if (!model) {
    context.agent.updateJob(job.id, {
      status: "failed",
      error: `Unknown model "${plan.model}".`,
    });
    return;
  }
  if (!model.available) {
    context.agent.updateJob(job.id, {
      status: "failed",
      error:
        model.unavailableReason ??
        `Model "${model.displayName}" is not available on this host.`,
    });
    return;
  }
  const provider = context.providerFor(model.provider);
  if (!provider?.configured) {
    context.agent.updateJob(job.id, {
      status: "failed",
      error: `No ${model.provider} provider is configured on this host.`,
    });
    return;
  }
  try {
    const cost = planCost(plan);
    const credits = Math.round(cost * 1000);
    if ((context.users.findById(job.ownerId)?.balanceMillicredits ?? 0) < credits) {
      context.agent.updateJob(job.id, {
        status: "failed",
        error: "Not enough credits for this plan.",
      });
      return;
    }
    const submitted = await provider.submit(model, {
      prompt: plan.prompt,
      duration: plan.duration ?? undefined,
    });
    const providerJob = context.jobs.create({
      userId: job.ownerId,
      modelKey: model.key,
      provider: model.provider,
      providerJobId: submitted.providerJobId,
      prompt: plan.prompt,
      referenceImages: [],
      costMillicredits: credits,
    });
    context.users.addBalance(job.ownerId, -credits);
    context.agent.updateJob(job.id, {
      status: "running",
      error: null,
      steps: plan.steps.map((step, index) => ({
        ...step,
        status: index === 0 ? "done" : "running",
      })),
      outputs: [],
      providerJobId: providerJob.id,
    });
  } catch (cause) {
    const message =
      cause instanceof ProviderError || cause instanceof Error
        ? cause.message
        : "The run failed.";
    context.agent.updateJob(job.id, { status: "failed", error: message });
  }
};
