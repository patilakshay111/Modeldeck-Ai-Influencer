/**
 * Studio routes.
 *
 *   GET    /api/studio/models
 *   POST   /api/studio/generate            { modelKey, prompt, images, ... }
 *   GET    /api/studio/status/:jobId
 *   GET    /api/studio/jobs
 *   GET    /api/studio/library
 *   GET    /api/studio/credits
 *   GET    /api/studio/influencers
 *   POST   /api/studio/influencers
 *   PATCH  /api/studio/influencers/:id
 *   DELETE /api/studio/influencers/:id
 *   GET    /api/studio/workflows
 *   POST   /api/studio/workflows
 *   PATCH  /api/studio/workflows/:id
 *   DELETE /api/studio/workflows/:id
 *
 * The start/poll shape follows the backend contract:
 * generate returns a job id, status reports the job. A caller polls; the
 * service never pushes.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { findModel, publicCatalogue } from "../models/registry.js";
import { imageTierPrices, priceRun } from "../models/pricing.js";
import { requireUser } from "./auth.js";
import { ProviderError } from "../providers/types.js";
import type { CharacterReference } from "../data/collections.js";

const generateSchema = z.object({
  modelKey: z.string().min(1),
  prompt: z.string().max(20_000).optional(),
  images: z.array(z.string().url()).max(8).optional(),
  aspectRatio: z.string().max(32).optional(),
  resolution: z.string().max(32).optional(),
  duration: z.string().max(16).optional(),
  seed: z.number().int().optional(),
  extra: z.record(z.unknown()).optional(),
});

const influencerSchema = z.object({
  handle: z.string().min(1).max(40),
  name: z.string().max(120).optional(),
  description: z.string().max(2_000).optional(),
  image: z.string().url(),
  /** When true, immediately build the identity kit from the anchor image. */
  buildKit: z.boolean().optional().default(true),
});

/** A reference image uploaded from the browser, as a data URL. */
const uploadSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i)
    .max(12_000_000),
  filename: z.string().max(200).optional(),
});

const workflowSchema = z.object({
  name: z.string().max(200).optional(),
  modelKey: z.string().min(1),
  prompt: z.string().max(20_000),
  settings: z.record(z.unknown()).optional(),
});

/** Polling is cheap; the wait between polls is the client's business. */
const pollProvider = async (
  context: AppContext,
  jobId: string,
): Promise<void> => {
  const job = context.jobs.get(jobId);
  if (!job || job.state === "completed" || job.state === "failed") return;
  const provider = context.providerFor(job.provider);
  if (!provider) {
    context.jobs.update(jobId, {
      state: "failed",
      error: `No ${job.provider} provider is configured on this host.`,
    });
    return;
  }
  const model = findModel(job.modelKey);
  if (!model) {
    context.jobs.update(jobId, {
      state: "failed",
      error: `Unknown model "${job.modelKey}".`,
    });
    return;
  }
  try {
    const status = await provider.status(model, job.providerJobId);
    if (status.state === "completed") {
      const bundle = await provider.result(model, job.providerJobId);
      const assets = [];
      for (const asset of bundle.assets) {
        assets.push(await context.storage.copyRemote(asset));
      }
      // OpenAI returns bytes rather than a URL.
      const raw = bundle.raw as { kind?: string; bytes?: Buffer; contentType?: string };
      if (raw?.kind === "openai-video-bytes" && raw.bytes) {
        assets.push(
          await context.storage.saveBytes(raw.bytes, raw.contentType ?? "video/mp4", "sora"),
        );
      }
      context.jobs.update(jobId, { state: "completed", assets, error: null });
      return;
    }
    if (status.state === "failed") {
      context.jobs.update(jobId, {
        state: "failed",
        error: status.error ?? "The provider reported a failure.",
      });
      return;
    }
    context.jobs.update(jobId, { state: status.state });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "The provider call failed.";
    context.jobs.update(jobId, { state: "failed", error: message });
  }
};

export const registerStudioRoutes = (
  app: FastifyInstance,
  context: AppContext,
): void => {
  app.get("/api/studio/models", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({
      models: publicCatalogue(
        Boolean(context.config.ENABLE_SPICY_MODELS),
      ).map((entry) => {
        const model = findModel(entry.key);
        if (!model) return entry;
        // Video models are priced per second, so the picker shows the price at
        // the model's default duration; image models are priced per tier.
        const defaultSeconds = Number(entry.durations[0] ?? 5);
        const representative = priceRun(model, {
          resolution: entry.resolutions[0],
          durationSeconds: model.priceIsPerSecond ? defaultSeconds : undefined,
        });
        return {
          ...entry,
          prices: imageTierPrices(model),
          defaultPrice: representative.credits,
          defaultPriceUsd: representative.providerUsd,
          providerUsd: model.providerUsd ?? null,
          /** What the customer pays, given the credit price on this host. */
          yourPriceUsd:
            representative.credits * context.config.CREDIT_PRICE_USD,
          creditPriceUsd: context.config.CREDIT_PRICE_USD,
        };
      }),
      providers: context.config.providers,
    });
  });

  app.post("/api/studio/generate", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    if (!user.ageAttestedAt) {
      return reply.code(403).send({
        error: "age_attestation_required",
        message: "Confirm your age before generating.",
      });
    }
    const parsed = generateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const model = findModel(parsed.data.modelKey);
    if (!model) {
      return reply.code(404).send({
        error: "unknown_model",
        message: `Unknown model "${parsed.data.modelKey}".`,
      });
    }
    if (!model.available) {
      return reply.code(503).send({
        error: "model_unavailable",
        message:
          model.unavailableReason ??
          `Model "${model.displayName}" is not available on this host.`,
      });
    }
    const provider = context.providerFor(model.provider);
    if (!provider?.configured) {
      return reply.code(503).send({
        error: "provider_unavailable",
        message: `No ${model.provider} provider is configured on this host.`,
      });
    }
    if (model.acceptsPrompt && !parsed.data.prompt?.trim()) {
      return reply.code(400).send({
        error: "invalid_input",
        message: `${model.displayName} needs a prompt.`,
      });
    }
    if (model.acceptsReferenceImages && (parsed.data.images?.length ?? 0) === 0) {
      return reply.code(400).send({
        error: "invalid_input",
        message: `${model.displayName} needs at least one reference image.`,
      });
    }
    const price = priceRun(model, {
      resolution: parsed.data.resolution,
      durationSeconds: parsed.data.duration
        ? Number(parsed.data.duration)
        : undefined,
      edit: (parsed.data.images?.length ?? 0) > 0,
      referenceCount: parsed.data.images?.length ?? 0,
    });
    if (user.balanceMillicredits < price.millicredits) {
      return reply.code(402).send({
        error: "insufficient_credits",
        message: "Not enough credits for this model.",
        balanceMillicredits: user.balanceMillicredits,
        requiredMillicredits: price.millicredits,
      });
    }

    try {
      const submitted = await provider.submit(model, {
        prompt: parsed.data.prompt,
        images: parsed.data.images,
        aspectRatio: parsed.data.aspectRatio,
        resolution: parsed.data.resolution,
        duration: parsed.data.duration,
        seed: parsed.data.seed,
        extra: parsed.data.extra,
      });
      const job = context.jobs.create({
        userId: user.id,
        modelKey: model.key,
        provider: model.provider,
        providerJobId: submitted.providerJobId,
        prompt: parsed.data.prompt ?? "",
        referenceImages: parsed.data.images ?? [],
        costMillicredits: price.millicredits,
      });
      context.users.addBalance(user.id, -price.millicredits);
      return reply.code(202).send({ jobId: job.id });
    } catch (cause) {
      if (cause instanceof ProviderError) {
        return reply.code(cause.retryable ? 502 : 400).send({
          error: "provider_error",
          message: cause.message,
        });
      }
      const message =
        cause instanceof Error ? cause.message : "The generation request failed.";
      return reply.code(502).send({ error: "provider_error", message });
    }
  });

  app.get("/api/studio/status/:jobId", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { jobId } = request.params as { jobId: string };
    const job = context.jobs.getForUser(jobId, user.id);
    if (!job) {
      return reply.code(404).send({ error: "not_found", message: "Unknown job." });
    }
    await pollProvider(context, job.id);
    const current = context.jobs.get(job.id)!;
    return reply.send({
      jobId: current.id,
      status: current.state,
      modelKey: current.modelKey,
      error: current.error,
      output: current.assets,
    });
  });

  app.get("/api/studio/jobs", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({
      jobs: context.jobs.listForUser(user.id).map((job) => ({
        jobId: job.id,
        modelKey: job.modelKey,
        status: job.state,
        prompt: job.prompt,
        createdAt: job.createdAt,
        output: job.assets,
        error: job.error,
      })),
    });
  });

  app.get("/api/studio/library", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const assets = context.jobs
      .listForUser(user.id)
      .filter((job) => job.state === "completed")
      .flatMap((job) =>
        job.assets.map((asset) => ({
          url: asset.url,
          contentType: asset.contentType,
          isVideo: asset.isVideo,
          modelKey: job.modelKey,
          prompt: job.prompt,
          jobId: job.id,
          createdAt: job.createdAt,
        })),
      );
    return reply.send({ assets });
  });

  app.get("/api/studio/credits", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({
      balanceMillicredits: user.balanceMillicredits,
      balanceCredits: user.balanceMillicredits / 1000,
    });
  });

  // ── Influencers (the face-lock character store) ──────────────────────────

  app.post("/api/studio/uploads", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = uploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_input",
        message: "A base64 image data URL is required.",
      });
    }
    const comma = parsed.data.dataUrl.indexOf(",");
    const header = parsed.data.dataUrl.slice(0, comma);
    const contentType = /data:([^;]+)/i.exec(header)?.[1] ?? "image/png";
    const bytes = Buffer.from(parsed.data.dataUrl.slice(comma + 1), "base64");
    if (bytes.length === 0) {
      return reply.code(400).send({
        error: "invalid_input",
        message: "The uploaded image was empty.",
      });
    }
    const asset = await context.storage.saveBytes(bytes, contentType, "reference");
    return reply.code(201).send({ url: asset.url, bytes: bytes.length });
  });

  app.get("/api/studio/influencers", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ influencers: context.collections.listInfluencers(user.id) });
  });

  app.post("/api/studio/influencers", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = influencerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    try {
      const influencer = context.collections.createInfluencer(user.id, {
        handle: parsed.data.handle,
        name: parsed.data.name ?? parsed.data.handle,
        description: parsed.data.description ?? "",
        image: parsed.data.image,
        kitStatus: "building",
      });

      if (parsed.data.buildKit) {
        void buildIdentityKit(context, influencer.id, user.id, parsed.data.image);
      }

      return reply.code(201).send({ influencer });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save.";
      return reply.code(409).send({ error: "conflict", message });
    }
  });

  app.get("/api/studio/influencers/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const influencer = context.collections.listInfluencers(user.id).find(
      (entry) => entry.id === id,
    );
    if (!influencer) {
      return reply.code(404).send({ error: "not_found", message: "Unknown influencer." });
    }
    // Poll in-flight kit jobs and fold results into the record.
    if (influencer.kitStatus === "building" && influencer.kitJobs.length > 0) {
      await pollKitJobs(context, influencer);
    }
    return reply.send({ influencer });
  });

  app.patch("/api/studio/influencers/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const parsed = influencerSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    try {
      const influencer = context.collections.updateInfluencer(user.id, id, parsed.data);
      if (!influencer) {
        return reply.code(404).send({ error: "not_found", message: "Unknown influencer." });
      }
      return reply.send({ influencer });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not update.";
      return reply.code(409).send({ error: "conflict", message });
    }
  });

  app.delete("/api/studio/influencers/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const removed = context.collections.deleteInfluencer(user.id, id);
    if (!removed) {
      return reply.code(404).send({ error: "not_found", message: "Unknown influencer." });
    }
    return reply.send({ ok: true });
  });

  // ── Workflows ────────────────────────────────────────────────────────────

  app.get("/api/studio/workflows", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ workflows: context.collections.listWorkflows(user.id) });
  });

  app.post("/api/studio/workflows", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = workflowSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const workflow = context.collections.createWorkflow(user.id, {
      name: parsed.data.name ?? "",
      modelKey: parsed.data.modelKey,
      prompt: parsed.data.prompt,
      settings: parsed.data.settings ?? {},
    });
    return reply.code(201).send({ workflow });
  });

  app.patch("/api/studio/workflows/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const parsed = workflowSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    const workflow = context.collections.updateWorkflow(user.id, id, parsed.data);
    if (!workflow) {
      return reply.code(404).send({ error: "not_found", message: "Unknown workflow." });
    }
    return reply.send({ workflow });
  });

  app.delete("/api/studio/workflows/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const { id } = request.params as { id: string };
    const removed = context.collections.deleteWorkflow(user.id, id);
    if (!removed) {
      return reply.code(404).send({ error: "not_found", message: "Unknown workflow." });
    }
    return reply.send({ ok: true });
  });
};

/** Build an identity kit from one face photo: turnaround + full body + spec. */
async function buildIdentityKit(
  context: AppContext,
  influencerId: string,
  userId: string,
  anchorUrl: string,
): Promise<void> {
  const provider = context.providerFor("fal");
  if (!provider?.configured) {
    context.collections.updateInfluencer(userId, influencerId, {
      kitStatus: "failed",
    });
    return;
  }

  const multipleAngles = findModel("flux-2-multiple-angles");
  const fullPortrait = findModel("flux-2-full-portrait");
  const bagel = findModel("bagel");
  if (!multipleAngles || !fullPortrait || !bagel) {
    context.collections.updateInfluencer(userId, influencerId, {
      kitStatus: "failed",
    });
    return;
  }

  const kitJobs: Array<{ modelKey: string; providerJobId: string; role: string }> =
    [];

  const submit = async (modelKey: string, role: string): Promise<void> => {
    const model = findModel(modelKey);
    if (!model) return;
    try {
      const submitted = await provider.submit(model, {
        images: [anchorUrl],
        prompt: "",
      });
      kitJobs.push({ modelKey, providerJobId: submitted.providerJobId, role });
    } catch {
      // Swallow individual failures; the influencer still exists, kit just
      // won't have every reference.
    }
  };

  await Promise.all([
    submit("flux-2-multiple-angles", "turnaround"),
    submit("flux-2-full-portrait", "full-body"),
    submit("bagel", "spec"),
  ]);

  context.collections.updateInfluencer(userId, influencerId, {
    kitJobs,
  });
}

/** Poll in-flight kit jobs and fold completed results into the influencer. */
async function pollKitJobs(context: AppContext, influencer: any): Promise<void> {
  const provider = context.providerFor("fal");
  if (!provider?.configured) return;

  const stillRunning: Array<{ modelKey: string; providerJobId: string; role: string }> =
    [];
  const references: CharacterReference[] =
    [...(influencer.references ?? [])];
  let specDone = false;
  let specText = influencer.spec ?? "";
  let allDone = true;

  for (const job of influencer.kitJobs) {
    const model = findModel(job.modelKey);
    if (!model) continue;
    try {
      const status = await provider.status(model, job.providerJobId);
      if (status.state === "completed") {
        const result = await provider.result(model, job.providerJobId);
        for (const asset of result.assets ?? []) {
          references.push({
            url: asset.url,
            role: job.role as CharacterReference["role"],
            source:
              job.modelKey === "flux-2-multiple-angles"
                ? "generated-multiple-angles"
                : job.modelKey === "flux-2-full-portrait"
                  ? "generated-full-body"
                  : "generated-multiple-angles",
          });
        }
        if (job.modelKey === "bagel") {
          specDone = true;
          const raw = (result.raw ?? {}) as Record<string, unknown>;
          const text =
            typeof raw.text === "string"
              ? raw.text
              : typeof raw.output === "string"
                ? raw.output
                : typeof raw.caption === "string"
                  ? raw.caption
                  : "";
          if (text) specText = text;
        }
      } else if (status.state === "failed") {
        allDone = false;
      } else {
        stillRunning.push(job);
        allDone = false;
      }
    } catch {
      stillRunning.push(job);
      allDone = false;
    }
  }

  if (stillRunning.length > 0) {
    context.collections.updateInfluencer(influencer.ownerId, influencer.id, {
      kitJobs: stillRunning,
      references,
    });
    return;
  }

  // All jobs are done (completed or failed). Save whatever we have.
  context.collections.applyKit(influencer.ownerId, influencer.id, {
    references,
    spec: specText,
  });
}
